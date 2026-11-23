import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SecurityEventType } from '@prisma/client';
import { MAX_CHALLENGE_ATTEMPTS, TwoFactorService } from './two-factor.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AccountGuardService } from './account-guard.service';
import type { SecurityLogsService } from '../../security-logs/security-logs.service';

// S-10: cada desafio de login 2FA aceita MAX_CHALLENGE_ATTEMPTS tentativas.
// Esgotadas, o desafio morre (e preciso a password outra vez) e fica uma
// linha no SecurityLog.
const RECOVERY_CODE = 'abcde-12345';
const WRONG_CODE = 'fffff-00000';
const EXPIRED_MESSAGE = 'Login expired. Please sign in again.';

function hashRecovery(code: string): string {
  return createHash('sha256')
    .update(code.toLowerCase().replace(/[^a-f0-9]/g, ''))
    .digest('hex');
}

function setup() {
  const user = {
    id: 'user-1',
    email: 'u@example.test',
    twoFactorEnabledAt: new Date(),
    twoFactorSecret: null,
    twoFactorLastStep: null,
    twoFactorRecoveryHashes: [hashRecovery(RECOVERY_CODE)],
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const securityLogs = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new TwoFactorService(
    prisma as unknown as PrismaService,
    new JwtService({}),
    { assertAccountIsUsable: jest.fn() } as unknown as AccountGuardService,
    securityLogs as unknown as SecurityLogsService,
  );
  return { service, prisma, securityLogs, user };
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  const err: unknown = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(UnauthorizedException);
  return (err as UnauthorizedException).message;
}

describe('TwoFactorService.completeLogin attempts per challenge', () => {
  const env = { ...process.env };

  beforeAll(() => {
    process.env.TWO_FACTOR_ENABLED = 'true';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    process.env = env;
  });

  it('burns the challenge after the last allowed failure and logs it', async () => {
    const { service, securityLogs, user } = setup();
    const token = service.createChallengeToken(user);

    for (let i = 1; i < MAX_CHALLENGE_ATTEMPTS; i += 1) {
      expect(await messageOf(service.completeLogin(token, WRONG_CODE))).toBe(
        'Invalid code.',
      );
    }
    expect(securityLogs.recordEvent).not.toHaveBeenCalled();

    expect(
      await messageOf(
        service.completeLogin(token, WRONG_CODE, {
          ip: '203.0.113.9',
          userAgent: 'jest',
        }),
      ),
    ).toBe(EXPIRED_MESSAGE);
    expect(securityLogs.recordEvent).toHaveBeenCalledTimes(1);
    expect(securityLogs.recordEvent).toHaveBeenCalledWith({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      ip: '203.0.113.9',
      method: 'POST',
      path: '/auth/2fa/login',
      userAgent: 'jest',
      userId: user.id,
    });
  });

  it('rejects even the right code on a burned challenge, before touching the DB', async () => {
    const { service, prisma, user } = setup();
    const token = service.createChallengeToken(user);
    for (let i = 0; i < MAX_CHALLENGE_ATTEMPTS; i += 1) {
      await service.completeLogin(token, WRONG_CODE).catch(() => undefined);
    }
    prisma.user.findUnique.mockClear();

    expect(await messageOf(service.completeLogin(token, RECOVERY_CODE))).toBe(
      EXPIRED_MESSAGE,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a valid code before the ceiling', async () => {
    const { service, user } = setup();
    const token = service.createChallengeToken(user);
    for (let i = 1; i < MAX_CHALLENGE_ATTEMPTS; i += 1) {
      await service.completeLogin(token, WRONG_CODE).catch(() => undefined);
    }
    await expect(service.completeLogin(token, RECOVERY_CODE)).resolves.toBe(
      user,
    );
  });

  it('counts parallel attempts before any of them finishes', async () => {
    const { service, prisma, user } = setup();
    const token = service.createChallengeToken(user);
    const results = await Promise.allSettled(
      Array.from({ length: MAX_CHALLENGE_ATTEMPTS + 3 }, () =>
        service.completeLogin(token, WRONG_CODE),
      ),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(
      MAX_CHALLENGE_ATTEMPTS,
    );
  });

  it('gives each challenge its own counter', async () => {
    const { service, prisma, user } = setup();
    const first = service.createChallengeToken(user);
    const second = service.createChallengeToken(user);
    expect(first).not.toBe(second);
    await service.completeLogin(first, WRONG_CODE).catch(() => undefined);
    prisma.user.findUnique.mockClear();
    await service.completeLogin(second, RECOVERY_CODE);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
