import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { MS_PER_DAY } from '../common/time.constants';
import { SentNotificationService } from './sent-notification.service';
import {
  PRISMA_FOREIGN_KEY_VIOLATION,
  PRISMA_UNIQUE_VIOLATION,
  SENT_NOTIFICATION_KIND,
} from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.DUE_TODAY_DIGEST;
const DAY = '2026-11-06';
const NOW = new Date('2026-11-06T10:00:00.000Z');
const RETENTION_DAYS = 30;

interface Row {
  userId: string;
  kind: string;
  periodKey: string;
  createdAt: Date;
}

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: 'test',
  });
}

// Prisma em memoria com a unique [userId, kind, periodKey] e a FK do user.
function setup(existingUsers: string[] = ['u1', 'u2']) {
  const rows: Row[] = [];
  const same = (r: Row, w: Omit<Row, 'createdAt'>) =>
    r.userId === w.userId && r.kind === w.kind && r.periodKey === w.periodKey;
  const sentNotification = {
    create: jest.fn(({ data }: { data: Omit<Row, 'createdAt'> }) => {
      if (!existingUsers.includes(data.userId)) {
        return Promise.reject(knownError(PRISMA_FOREIGN_KEY_VIOLATION));
      }
      if (rows.some((r) => same(r, data))) {
        return Promise.reject(knownError(PRISMA_UNIQUE_VIOLATION));
      }
      rows.push({ ...data, createdAt: new Date() });
      return Promise.resolve({ id: String(rows.length) });
    }),
    createMany: jest.fn(({ data }: { data: Omit<Row, 'createdAt'>[] }) => {
      let count = 0;
      for (const row of data) {
        if (rows.some((r) => same(r, row))) continue;
        rows.push({ ...row, createdAt: new Date() });
        count += 1;
      }
      return Promise.resolve({ count });
    }),
    deleteMany: jest.fn(
      ({
        where,
      }: {
        where: Partial<Omit<Row, 'createdAt'>> & {
          createdAt?: { lt: Date };
        };
      }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          const match =
            (where.userId === undefined || r.userId === where.userId) &&
            (where.kind === undefined || r.kind === where.kind) &&
            (where.periodKey === undefined ||
              r.periodKey === where.periodKey) &&
            (where.createdAt === undefined || r.createdAt < where.createdAt.lt);
          if (match) rows.splice(i, 1);
        }
        return Promise.resolve({ count: before - rows.length });
      },
    ),
    findMany: jest.fn(
      ({
        where,
      }: {
        where: { userId: { in: string[] }; kind: string; periodKey: string };
      }) =>
        Promise.resolve(
          rows
            .filter(
              (r) =>
                where.userId.in.includes(r.userId) &&
                r.kind === where.kind &&
                r.periodKey === where.periodKey,
            )
            .map((r) => ({ userId: r.userId })),
        ),
    ),
  };
  const service = new SentNotificationService({
    sentNotification,
  } as unknown as PrismaService);
  return { service, rows, sentNotification };
}

describe('SentNotificationService', () => {
  it('claim succeeds once and fails the second time (unique violation)', async () => {
    const { service } = setup();
    expect(await service.claim('u1', KIND, DAY)).toBe(true);
    expect(await service.claim('u1', KIND, DAY)).toBe(false);
  });

  it('claims are per user, kind and period', async () => {
    const { service } = setup();
    expect(await service.claim('u1', KIND, DAY)).toBe(true);
    expect(await service.claim('u2', KIND, DAY)).toBe(true);
    expect(
      await service.claim('u1', SENT_NOTIFICATION_KIND.STREAK_RISK, DAY),
    ).toBe(true);
    expect(await service.claim('u1', KIND, '2026-11-07')).toBe(true);
  });

  it('release lets the next claim succeed again', async () => {
    const { service, sentNotification } = setup();
    expect(await service.claim('u1', KIND, DAY)).toBe(true);
    await service.release('u1', KIND, DAY);
    expect(sentNotification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', kind: KIND, periodKey: DAY },
    });
    expect(await service.claim('u1', KIND, DAY)).toBe(true);
  });

  it('a deleted user is not claimable (foreign key violation)', async () => {
    const { service } = setup(['u1']);
    expect(await service.claim('ghost', KIND, DAY)).toBe(false);
  });

  it('other errors are rethrown', async () => {
    const { service, sentNotification } = setup();
    sentNotification.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.claim('u1', KIND, DAY)).rejects.toThrow('db down');
  });

  it('claimedUserIds returns only the given users with the marker', async () => {
    const { service, sentNotification } = setup();
    await service.claim('u1', KIND, DAY);
    const claimed = await service.claimedUserIds(['u1', 'u2'], KIND, DAY);
    expect([...claimed]).toEqual(['u1']);
    expect(sentNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: { in: ['u1', 'u2'] }, kind: KIND, periodKey: DAY },
      }),
    );
  });

  it('claimedUserIds and markMany skip the query for an empty list', async () => {
    const { service, sentNotification } = setup();
    expect((await service.claimedUserIds([], KIND, DAY)).size).toBe(0);
    await service.markMany([], KIND, DAY);
    expect(sentNotification.findMany).not.toHaveBeenCalled();
    expect(sentNotification.createMany).not.toHaveBeenCalled();
  });

  it('markMany marks without duplicates and blocks later claims', async () => {
    const { service, sentNotification } = setup();
    await service.claim('u1', KIND, DAY);
    await service.markMany(['u1', 'u2'], KIND, DAY);
    expect(sentNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(await service.claim('u2', KIND, DAY)).toBe(false);
  });

  it('purgeOlderThan deletes only markers older than the cutoff', async () => {
    const { service, rows, sentNotification } = setup();
    rows.push(
      {
        userId: 'u1',
        kind: KIND,
        periodKey: '2026-09-01',
        createdAt: new Date(NOW.getTime() - (RETENTION_DAYS + 1) * MS_PER_DAY),
      },
      {
        userId: 'u1',
        kind: KIND,
        periodKey: DAY,
        createdAt: new Date(NOW.getTime() - MS_PER_DAY),
      },
    );
    expect(await service.purgeOlderThan(RETENTION_DAYS, NOW)).toBe(1);
    expect(sentNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: new Date(NOW.getTime() - RETENTION_DAYS * MS_PER_DAY),
        },
      },
    });
    expect(rows.map((r) => r.periodKey)).toEqual([DAY]);
  });
});
