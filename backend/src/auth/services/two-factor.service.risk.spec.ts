import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MAX_CHALLENGE_ATTEMPTS, TwoFactorService } from './two-factor.service';
import {
  base32Decode,
  currentTotpStep,
  generateTotpSecret,
  hotp,
} from './totp.util';
import { encryptToken } from '../../crypto/token-cipher';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AccountGuardService } from './account-guard.service';
import type { SecurityLogsService } from '../../security-logs/security-logs.service';

const RECOVERY_CODE = 'abcde-12345';

function hashRecovery(code: string): string {
  return createHash('sha256')
    .update(code.toLowerCase().replace(/[^a-f0-9]/g, ''))
    .digest('hex');
}

function setup(over: Record<string, unknown> = {}) {
  const secret = generateTotpSecret();
  const user = {
    id: 'user-1',
    email: 'u@example.test',
    twoFactorEnabledAt: new Date(),
    twoFactorSecret: encryptToken(secret),
    twoFactorLastStep: null as number | null,
    twoFactorRecoveryHashes: [hashRecovery(RECOVERY_CODE)],
    ...over,
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(user)),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(() => Promise.resolve(user)),
      // Como a BD: o proximo findUnique ja ve o passo gasto.
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(user, data);
          return Promise.resolve(user);
        }),
      updateMany: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { twoFactorRecoveryHashes: { has: string } };
            data: Record<string, unknown>;
          }) => {
            if (
              !user.twoFactorRecoveryHashes.includes(
                where.twoFactorRecoveryHashes.has,
              )
            ) {
              return Promise.resolve({ count: 0 });
            }
            Object.assign(user, data);
            return Promise.resolve({ count: 1 });
          },
        ),
    },
  };
  const securityLogs = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new TwoFactorService(
    prisma as unknown as PrismaService,
    new JwtService({}),
    { assertAccountIsUsable: jest.fn() } as unknown as AccountGuardService,
    securityLogs as unknown as SecurityLogsService,
  );
  return { service, prisma, securityLogs, user, secret };
}

function codeAt(secret: string, step: number): string {
  return hotp(base32Decode(secret), step);
}

describe('TwoFactorService risk', () => {
  const env = { ...process.env };

  beforeAll(() => {
    process.env.TWO_FACTOR_ENABLED = 'true';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  afterAll(() => {
    process.env = env;
  });

  describe('TOTP replay', () => {
    it('rejects the same valid code used a second time', async () => {
      const { service, secret, user } = setup();
      const code = codeAt(secret, currentTotpStep());

      await expect(
        service.completeLogin(service.createChallengeToken(user), code),
      ).resolves.toBe(user);
      await expect(
        service.completeLogin(service.createChallengeToken(user), code),
      ).rejects.toThrow('Invalid code.');
    });

    it('rejects an older step than the last one used, even inside the window', async () => {
      const { service, secret, user } = setup();
      const step = currentTotpStep();
      await service.completeLogin(
        service.createChallengeToken(user),
        codeAt(secret, step + 1),
      );
      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          codeAt(secret, step - 1),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a code outside the +-1 window', async () => {
      const { service, secret, user } = setup();
      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          codeAt(secret, currentTotpStep() + 3),
        ),
      ).rejects.toThrow('Invalid code.');
    });

    it('disable() also refuses a replayed code and keeps 2FA on', async () => {
      const { service, secret, user } = setup();
      const code = codeAt(secret, currentTotpStep());
      await service.completeLogin(service.createChallengeToken(user), code);
      await expect(service.disable(user.id, code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(user.twoFactorEnabledAt).not.toBeNull();
    });
  });

  describe('recovery codes', () => {
    it('works once and is spent afterwards', async () => {
      const { service, user, prisma } = setup();

      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          RECOVERY_CODE,
        ),
      ).resolves.toBe(user);
      expect(user.twoFactorRecoveryHashes).toEqual([]);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          twoFactorRecoveryHashes: { has: hashRecovery(RECOVERY_CODE) },
        },
        data: { twoFactorRecoveryHashes: [] },
      });

      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          RECOVERY_CODE,
        ),
      ).rejects.toThrow('Invalid code.');
    });

    it('is case and separator insensitive', async () => {
      const { service, user } = setup();
      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          '  ABCDE12345 ',
        ),
      ).resolves.toBe(user);
    });

    it('loses the race: a parallel spend (count 0) is rejected', async () => {
      const { service, user, prisma } = setup();
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.completeLogin(
          service.createChallengeToken(user),
          RECOVERY_CODE,
        ),
      ).rejects.toThrow('Invalid code.');
    });

    it('only spends the matching code, keeping the others', async () => {
      const other = hashRecovery('11111-22222');
      const { service, user } = setup({
        twoFactorRecoveryHashes: [hashRecovery(RECOVERY_CODE), other],
      });
      await service.completeLogin(
        service.createChallengeToken(user),
        RECOVERY_CODE,
      );
      expect(user.twoFactorRecoveryHashes).toEqual([other]);
    });
  });

  describe('attempt counters', () => {
    it('S-10: the challenge dies after MAX attempts, and the right code no longer works', async () => {
      const { service, secret, user, securityLogs } = setup();
      const token = service.createChallengeToken(user);
      for (let i = 0; i < MAX_CHALLENGE_ATTEMPTS; i += 1) {
        await expect(
          service.completeLogin(token, '000000', { ip: '203.0.113.1' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      expect(securityLogs.recordEvent).toHaveBeenCalledTimes(1);
      await expect(
        service.completeLogin(token, codeAt(secret, currentTotpStep())),
      ).rejects.toThrow('Login expired. Please sign in again.');
    });

    it('a success clears the counter of that challenge', async () => {
      const { service, secret, user } = setup();
      const token = service.createChallengeToken(user);
      for (let i = 0; i < MAX_CHALLENGE_ATTEMPTS - 1; i += 1) {
        await expect(service.completeLogin(token, '000000')).rejects.toThrow(
          'Invalid code.',
        );
      }
      await expect(
        service.completeLogin(token, codeAt(secret, currentTotpStep())),
      ).resolves.toBe(user);
    });

    it('5 wrong codes lock the account for fresh challenges (429)', async () => {
      const { service, secret, user } = setup();
      // 5 desafios distintos, 1 falha cada: o bloqueio por conta apanha-os.
      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.completeLogin(service.createChallengeToken(user), '000000'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      const err: unknown = await service
        .completeLogin(
          service.createChallengeToken(user),
          codeAt(secret, currentTotpStep()),
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
    });

    it('rejects a token with the wrong purpose', async () => {
      const { service, user } = setup();
      const jwt = new JwtService({});
      const forged = jwt.sign(
        { sub: user.id, purpose: 'session' },
        { secret: 'x' },
      );
      await expect(service.completeLogin(forged, '000000')).rejects.toThrow(
        'Login expired. Please sign in again.',
      );
    });
  });

  describe('setup and feature flag', () => {
    it('confirmSetup activates, stores the step and returns 10 single-use codes', async () => {
      const { service, secret, user } = setup({
        twoFactorEnabledAt: null,
        twoFactorRecoveryHashes: [],
      });
      const step = currentTotpStep();
      const { recoveryCodes } = await service.confirmSetup(
        user.id,
        ` ${codeAt(secret, step)} `,
      );
      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);
      expect(user.twoFactorEnabledAt).toBeInstanceOf(Date);
      expect(user.twoFactorLastStep).toBe(step);
      // so hashes na BD, nunca os codigos em claro
      expect(user.twoFactorRecoveryHashes).toEqual(
        recoveryCodes.map(hashRecovery),
      );
    });

    it('confirmSetup rejects a wrong code and leaves 2FA off', async () => {
      const { service, user } = setup({ twoFactorEnabledAt: null });
      await expect(service.confirmSetup(user.id, '000000')).rejects.toThrow(
        BadRequestException,
      );
      expect(user.twoFactorEnabledAt).toBeNull();
    });

    it('beginSetup refuses when already on', async () => {
      const { service, user } = setup();
      await expect(service.beginSetup(user.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('flag off: 404 everywhere and no challenge required', async () => {
      process.env.TWO_FACTOR_ENABLED = 'false';
      try {
        const { service, user } = setup();
        expect(service.requiresChallenge(user)).toBe(false);
        await expect(
          service.completeLogin('x', '000000'),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.getStatus(user.id)).resolves.toEqual({
          available: false,
          enabled: false,
          recoveryCodesLeft: 0,
        });
      } finally {
        process.env.TWO_FACTOR_ENABLED = 'true';
      }
    });
  });
});
