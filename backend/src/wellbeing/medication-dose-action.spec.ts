// "Taken" button on medication reminder notifications: signed single-dose
// token (MedicationDoseActionTokenService) consumed by
// POST /wellbeing/medications/dose-action without session or CSRF.
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import { MedicationsService } from './medications.service';
import { MedicationDoseActionTokenService } from './medication-dose-action.token';
import { MedicationDoseActionController } from './medication-dose-action.controller';
import { MedicationDoseActionDto } from './dto/medication.dto';
import {
  MEDICATION_DOSE_ACTION_KEY_LABEL,
  MEDICATION_DOSE_ACTION_PURPOSE,
  MEDICATION_REMINDER_WINDOW_MINUTES,
} from './wellbeing.constants';
import { SKIP_CSRF_KEY } from '../common/decorators/skip-csrf.decorator';
import { MS_PER_MINUTE } from '../common/time.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { MedicationDisclaimerService } from './medication-disclaimer.service';

const TEST_SECRET = 'test-jwt-secret-for-dose-actions';
const DAY = new Date('2026-12-01T00:00:00.000Z');
const SLOT = 480;
const OTHER_SLOT = 1260;

interface DoseRow {
  userId: string;
  medicationId: string;
  date: Date;
  slotMinutes: number;
  takenAt: Date | null;
}

interface MedRow {
  id: string;
  userId: string;
  times: number[];
}

type Where = Record<string, unknown>;

function rowMatches(row: DoseRow, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (cond instanceof Date) {
      return value instanceof Date && value.getTime() === cond.getTime();
    }
    return value === cond;
  });
}

function setup(
  meds: MedRow[] = [{ id: 'm1', userId: 'u1', times: [SLOT, OTHER_SLOT] }],
) {
  const doses: DoseRow[] = [];
  const prisma = {
    medication: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) =>
          Promise.resolve(
            meds.find((m) => m.id === where.id && m.userId === where.userId) ??
              null,
          ),
      ),
    },
    medicationDose: {
      updateMany: jest.fn(
        ({ where, data }: { where: Where; data: Partial<DoseRow> }) => {
          const hit = doses.filter((d) => rowMatches(d, where));
          for (const d of hit) Object.assign(d, data);
          return Promise.resolve({ count: hit.length });
        },
      ),
      create: jest.fn(({ data }: { data: DoseRow }) => {
        const dup = doses.some(
          (d) =>
            d.medicationId === data.medicationId &&
            d.date.getTime() === data.date.getTime() &&
            d.slotMinutes === data.slotMinutes,
        );
        if (dup) {
          return Promise.reject(
            Object.assign(new Error('dup'), { code: 'P2002' }),
          );
        }
        doses.push({ ...data });
        return Promise.resolve({});
      }),
    },
  };
  const tokens = new MedicationDoseActionTokenService();
  const service = new MedicationsService(
    prisma as unknown as PrismaService,
    { notifyUser: jest.fn() } as unknown as PushService,
    {} as MedicationDisclaimerService,
    tokens,
  );
  return { service, tokens, prisma, doses };
}

const derivedSecret = () =>
  createHmac('sha256', TEST_SECRET)
    .update(MEDICATION_DOSE_ACTION_KEY_LABEL)
    .digest('hex');

describe('medication dose action ("Taken" from the notification)', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });
  afterEach(() => jest.useRealTimers());

  const target = {
    userId: 'u1',
    medicationId: 'm1',
    date: DAY,
    slotMinutes: SLOT,
  };

  describe('token', () => {
    it('round-trips the single dose it was issued for', () => {
      const tokens = new MedicationDoseActionTokenService();
      const claims = tokens.verify(tokens.issue(target));
      expect(claims).toMatchObject({
        userId: 'u1',
        medicationId: 'm1',
        dateKey: '2026-12-01',
        slotMinutes: SLOT,
      });
      expect(claims?.jti).toEqual(expect.any(String));
    });

    it('every token has a unique jti', () => {
      const tokens = new MedicationDoseActionTokenService();
      const a = tokens.verify(tokens.issue(target));
      const b = tokens.verify(tokens.issue(target));
      expect(a?.jti).not.toBe(b?.jti);
    });

    it('expires with the reminder window', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-12-01T08:00:00Z'));
      const tokens = new MedicationDoseActionTokenService();
      const token = tokens.issue(target);
      jest.setSystemTime(
        new Date(
          Date.now() + (MEDICATION_REMINDER_WINDOW_MINUTES + 1) * MS_PER_MINUTE,
        ),
      );
      expect(tokens.verify(token)).toBeNull();
    });

    it('rejects a tampered payload', () => {
      const tokens = new MedicationDoseActionTokenService();
      const [header, , signature] = tokens.issue(target).split('.');
      const forged = Buffer.from(
        JSON.stringify({
          sub: 'u1',
          mid: 'm2',
          date: '2026-12-01',
          slot: SLOT,
          purpose: MEDICATION_DOSE_ACTION_PURPOSE,
          jti: 'x',
        }),
      ).toString('base64url');
      expect(tokens.verify(`${header}.${forged}.${signature}`)).toBeNull();
    });

    it('rejects a token with another purpose, even signed with the same key', () => {
      const other = new JwtService().sign(
        {
          sub: 'u1',
          mid: 'm1',
          date: '2026-12-01',
          slot: SLOT,
          purpose: 'link-password',
        },
        { secret: derivedSecret(), expiresIn: 60, jwtid: 'j1' },
      );
      expect(new MedicationDoseActionTokenService().verify(other)).toBeNull();
    });

    it('rejects a session-style token signed with the raw JWT_SECRET', () => {
      const session = new JwtService().sign(
        {
          sub: 'u1',
          mid: 'm1',
          date: '2026-12-01',
          slot: SLOT,
          purpose: MEDICATION_DOSE_ACTION_PURPOSE,
        },
        { secret: TEST_SECRET, expiresIn: 60, jwtid: 'j1' },
      );
      expect(new MedicationDoseActionTokenService().verify(session)).toBeNull();
    });

    it('is never valid as a session token (separate derived key)', () => {
      const token = new MedicationDoseActionTokenService().issue(target);
      expect(() => {
        new JwtService().verify<object>(token, { secret: TEST_SECRET });
      }).toThrow();
    });

    it('rejects an unsigned (alg none) token', () => {
      const body = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${body({ alg: 'none', typ: 'JWT' })}.${body({
        sub: 'u1',
        mid: 'm1',
        date: '2026-12-01',
        slot: SLOT,
        purpose: MEDICATION_DOSE_ACTION_PURPOSE,
        jti: 'x',
        exp: Math.floor(Date.now() / 1000) + 60,
      })}.`;
      expect(
        new MedicationDoseActionTokenService().verify(unsigned),
      ).toBeNull();
    });
  });

  describe('takeDoseFromAction', () => {
    it('a valid token marks only that dose as taken', async () => {
      const { service, tokens, doses } = setup();
      doses.push({
        userId: 'u1',
        medicationId: 'm1',
        date: DAY,
        slotMinutes: OTHER_SLOT,
        takenAt: null,
      });
      await expect(
        service.takeDoseFromAction(tokens.issue(target)),
      ).resolves.toEqual({
        status: 'taken',
      });
      const taken = doses.filter((d) => d.takenAt !== null);
      expect(taken).toHaveLength(1);
      expect(taken[0]).toMatchObject({
        userId: 'u1',
        medicationId: 'm1',
        slotMinutes: SLOT,
      });
      expect(taken[0].date.getTime()).toBe(DAY.getTime());
    });

    it('marks an already reminded (untaken) row without creating another', async () => {
      const { service, tokens, doses, prisma } = setup();
      doses.push({
        userId: 'u1',
        medicationId: 'm1',
        date: DAY,
        slotMinutes: SLOT,
        takenAt: null,
      });
      await service.takeDoseFromAction(tokens.issue(target));
      expect(prisma.medicationDose.create).not.toHaveBeenCalled();
      expect(doses).toHaveLength(1);
      expect(doses[0].takenAt).not.toBeNull();
    });

    it('a dose already taken in the app is a 200 no-op that keeps the original time', async () => {
      const { service, tokens, doses } = setup();
      const before = new Date('2026-12-01T08:05:00Z');
      doses.push({
        userId: 'u1',
        medicationId: 'm1',
        date: DAY,
        slotMinutes: SLOT,
        takenAt: before,
      });
      await expect(
        service.takeDoseFromAction(tokens.issue(target)),
      ).resolves.toEqual({
        status: 'already-taken',
      });
      expect(doses[0].takenAt).toBe(before);
    });

    it('a replayed token is idempotent and never writes again', async () => {
      const { service, tokens, doses, prisma } = setup();
      const token = tokens.issue(target);
      await service.takeDoseFromAction(token);
      // The user unticks the dose in the app; the old token must not re-tick it.
      doses[0].takenAt = null;
      prisma.medicationDose.updateMany.mockClear();
      prisma.medicationDose.create.mockClear();
      prisma.medication.findFirst.mockClear();
      await expect(service.takeDoseFromAction(token)).resolves.toEqual({
        status: 'already-taken',
      });
      expect(doses[0].takenAt).toBeNull();
      expect(prisma.medicationDose.updateMany).not.toHaveBeenCalled();
      expect(prisma.medicationDose.create).not.toHaveBeenCalled();
      expect(prisma.medication.findFirst).not.toHaveBeenCalled();
    });

    it('rejects expired, tampered or wrong-purpose tokens with 401 and no writes', async () => {
      const { service, tokens, prisma } = setup();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-12-01T08:00:00Z'));
      const expired = tokens.issue(target);
      jest.setSystemTime(
        new Date(
          Date.now() + (MEDICATION_REMINDER_WINDOW_MINUTES + 1) * MS_PER_MINUTE,
        ),
      );
      const wrongPurpose = new JwtService().sign(
        {
          sub: 'u1',
          mid: 'm1',
          date: '2026-12-01',
          slot: SLOT,
          purpose: 'other',
        },
        { secret: derivedSecret(), expiresIn: 60, jwtid: 'j2' },
      );
      const [h, p] = tokens.issue(target).split('.');
      const tampered = `${h}.${p}.AAAA`;
      for (const bad of [expired, wrongPurpose, tampered]) {
        await expect(service.takeDoseFromAction(bad)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      }
      expect(prisma.medication.findFirst).not.toHaveBeenCalled();
      expect(prisma.medicationDose.updateMany).not.toHaveBeenCalled();
      expect(prisma.medicationDose.create).not.toHaveBeenCalled();
    });

    it("a token naming another user's medication is rejected (ownership from the token)", async () => {
      const { service, tokens, prisma, doses } = setup([
        { id: 'm1', userId: 'u1', times: [SLOT] },
      ]);
      const foreign = tokens.issue({ ...target, userId: 'u2' });
      await expect(service.takeDoseFromAction(foreign)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.medication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'm1', userId: 'u2' }) as unknown,
        }),
      );
      expect(doses).toHaveLength(0);
    });

    it('a slot that is no longer one of the medication times is rejected', async () => {
      const { service, tokens, doses } = setup([
        { id: 'm1', userId: 'u1', times: [OTHER_SLOT] },
      ]);
      await expect(
        service.takeDoseFromAction(tokens.issue(target)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(doses).toHaveLength(0);
    });

    it('the error never says why (same response for every invalid case)', async () => {
      const { service, tokens } = setup([
        { id: 'm1', userId: 'u1', times: [SLOT] },
      ]);
      const messages = await Promise.all(
        ['a.b.c', tokens.issue({ ...target, userId: 'u2' })].map((t) =>
          service.takeDoseFromAction(t).catch((e: Error) => e.message),
        ),
      );
      expect(new Set(messages).size).toBe(1);
    });
  });

  describe('endpoint', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', metatype: MedicationDoseActionDto });

    it('never accepts a userId (or anything but the token) in the body', async () => {
      await expect(
        validate({ token: 'a.b.c', userId: 'u2' }),
      ).rejects.toThrow();
      await expect(
        validate({ token: 'a.b.c', medicationId: 'm2' }),
      ).rejects.toThrow();
      await expect(validate({ token: 'a.b.c' })).resolves.toBeInstanceOf(
        MedicationDoseActionDto,
      );
    });

    it('rejects a malformed or oversized token before touching the service', async () => {
      await expect(validate({ token: 'not a jwt' })).rejects.toThrow();
      await expect(
        validate({ token: `a.b.${'c'.repeat(2000)}` }),
      ).rejects.toThrow();
      await expect(validate({})).rejects.toThrow();
    });

    it('passes only the token to the service', async () => {
      const takeDoseFromAction = jest
        .fn()
        .mockResolvedValue({ status: 'taken' });
      const controller = new MedicationDoseActionController({
        takeDoseFromAction,
      } as unknown as MedicationsService);
      await controller.takeDose({ token: 'a.b.c' });
      expect(takeDoseFromAction).toHaveBeenCalledWith('a.b.c');
    });

    it('skips CSRF and has no session guard (the token is the credential)', () => {
      const handler = Object.getOwnPropertyDescriptor(
        MedicationDoseActionController.prototype,
        'takeDose',
      )?.value as object;
      expect(Reflect.getMetadata(SKIP_CSRF_KEY, handler)).toBe(true);
      expect(
        Reflect.getMetadata(GUARDS_METADATA, MedicationDoseActionController),
      ).toBeUndefined();
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    });

    it('is throttled', () => {
      const handler = Object.getOwnPropertyDescriptor(
        MedicationDoseActionController.prototype,
        'takeDose',
      )?.value as object;
      const keys = Reflect.getMetadataKeys(handler) as string[];
      expect(keys.some((k) => String(k).startsWith('THROTTLER:LIMIT'))).toBe(
        true,
      );
    });
  });

  describe('reminder push', () => {
    function reminderSetup(meds: { id: string; times: number[] }[]) {
      const prisma = {
        medication: {
          findMany: jest
            .fn()
            .mockResolvedValue(
              meds.map((m) => ({ ...m, userId: 'u1', name: 'Med', doses: [] })),
            ),
        },
        medicationDose: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const push = { notifyUser: jest.fn().mockResolvedValue(1) };
      const tokens = new MedicationDoseActionTokenService();
      const service = new MedicationsService(
        prisma as unknown as PrismaService,
        push as unknown as PushService,
        {} as MedicationDisclaimerService,
        tokens,
      );
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-12-01T08:15:00Z'));
      return { service, push, tokens };
    }

    it('one due dose: the push carries a token bound to that dose', async () => {
      const { service, push, tokens } = reminderSetup([
        { id: 'm1', times: [SLOT] },
      ]);
      await service.sendDueReminders();
      const [userId, key, options] = push.notifyUser.mock.calls[0] as [
        string,
        string,
        { doseAction?: { token: string } },
      ];
      expect([userId, key]).toEqual(['u1', 'medicationDue']);
      expect(tokens.verify(options.doseAction?.token ?? '')).toMatchObject({
        userId: 'u1',
        medicationId: 'm1',
        dateKey: '2026-12-01',
        slotMinutes: SLOT,
      });
    });

    it('several medications in one push: no action button (ambiguous dose)', async () => {
      const { service, push } = reminderSetup([
        { id: 'm1', times: [SLOT] },
        { id: 'm2', times: [SLOT] },
      ]);
      await service.sendDueReminders();
      const [, key, options] = push.notifyUser.mock.calls[0] as [
        string,
        string,
        { doseAction?: unknown },
      ];
      expect(key).toBe('medicationsDue');
      expect(options.doseAction).toBeUndefined();
    });

    it('two due times of the same medication: no action button either', async () => {
      const { service, push } = reminderSetup([
        { id: 'm1', times: [SLOT - 30, SLOT] },
      ]);
      await service.sendDueReminders();
      const [, key, options] = push.notifyUser.mock.calls[0] as [
        string,
        string,
        { doseAction?: unknown },
      ];
      expect(key).toBe('medicationDue');
      expect(options.doseAction).toBeUndefined();
    });
  });
});
