import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import { MONTHLY_DIGEST_USER_BATCH_SIZE } from './monthly-digest.constants';
import {
  isInMonthlyDigestWindow,
  MonthlyDigestService,
  previousMonthKey,
} from './monthly-digest.service';
import { FakeSentNotificationService } from './sent-notification.fake';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

// Novembro: Lisboa = UTC. Dia 1 as 09:15 -> resume outubro de 2026.
const FIRST_MORNING = new Date('2026-11-01T09:15:00.000Z');
const LATER_SAME_DAY = new Date('2026-11-01T10:00:00.000Z');
const SECOND_DAY = new Date('2026-11-02T09:15:00.000Z');
const NEXT_MONTH = new Date('2026-12-01T09:15:00.000Z');
// 1 de outubro 00:00 em Lisboa (verao) = 30 set 23:00 UTC.
const OCT_START = new Date('2026-09-30T23:00:00.000Z');
const OCT_END = new Date('2026-11-01T00:00:00.000Z');

interface UserRow {
  id: string;
  email?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  pushSubscriptions?: { lang: string | null }[];
}

interface Data {
  completed: Record<string, { count: number; avg: number | null }>;
  overdue: Record<string, number>;
  sessions: {
    userId: string;
    minutes: number;
    areaName: string | null;
  }[];
}

interface GroupByArgs {
  where: { userId: { in: string[] }; completedAt?: unknown };
}

function setup(
  opts: { users?: UserRow[]; data?: Partial<Data>; mailOk?: boolean } = {},
) {
  const users = (opts.users ?? [{ id: 'u1' }]).map((u) => ({
    email: `${u.id}@example.test`,
    quietHoursStart: null,
    quietHoursEnd: null,
    pushSubscriptions: [],
    ...u,
  }));
  const data: Data = {
    completed: { u1: { count: 3, avg: 15.25 } },
    overdue: { u1: 1 },
    sessions: [{ userId: 'u1', minutes: 90, areaName: 'Maths' }],
    ...opts.data,
  };
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    task: {
      // Imita o groupBy: so devolve os users pedidos no filtro userId. A
      // primeira chamada (com completedAt) e a das concluidas.
      groupBy: jest.fn((args: GroupByArgs) => {
        const ids = args.where.userId.in;
        if ('completedAt' in args.where && !('OR' in args.where)) {
          return Promise.resolve(
            ids
              .filter((id) => data.completed[id])
              .map((id) => ({
                userId: id,
                _count: { _all: data.completed[id].count },
                _avg: { realGrade: data.completed[id].avg },
              })),
          );
        }
        return Promise.resolve(
          ids
            .filter((id) => (data.overdue[id] ?? 0) > 0)
            .map((id) => ({ userId: id, _count: { _all: data.overdue[id] } })),
        );
      }),
    },
    studySession: {
      findMany: jest.fn((args: { where: { userId: { in: string[] } } }) =>
        Promise.resolve(
          data.sessions
            .filter((s) => args.where.userId.in.includes(s.userId))
            .map((s) => ({
              userId: s.userId,
              startedAt: new Date('2026-10-10T10:00:00.000Z'),
              endedAt: new Date(
                new Date('2026-10-10T10:00:00.000Z').getTime() +
                  s.minutes * 60_000,
              ),
              area: s.areaName ? { name: s.areaName } : null,
            })),
        ),
      ),
    },
  };
  const mail = {
    sendMonthlyDigestEmail: jest.fn().mockResolvedValue(opts.mailOk ?? true),
  };
  const sent = new FakeSentNotificationService();
  const service = new MonthlyDigestService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    sent.asService(),
  );
  return { service, prisma, mail, sent };
}

describe('MonthlyDigestService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIRST_MORNING);
  });
  afterEach(() => jest.useRealTimers());

  it('window is day 1 between the start and end hours', () => {
    const first = new Date('2026-11-01T00:00:00.000Z');
    const second = new Date('2026-11-02T00:00:00.000Z');
    expect(isInMonthlyDigestWindow(first, 9 * 60 - 1)).toBe(false);
    expect(isInMonthlyDigestWindow(first, 9 * 60)).toBe(true);
    expect(isInMonthlyDigestWindow(first, 21 * 60)).toBe(false);
    expect(isInMonthlyDigestWindow(second, 10 * 60)).toBe(false);
  });

  it('previous month key crosses the year', () => {
    expect(previousMonthKey(new Date('2026-11-01T00:00:00.000Z'))).toBe(
      '2026-10',
    );
    expect(previousMonthKey(new Date('2027-01-01T00:00:00.000Z'))).toBe(
      '2026-12',
    );
  });

  it('sends the previous month numbers once', async () => {
    const { service, mail } = setup({
      users: [{ id: 'u1', pushSubscriptions: [{ lang: 'pt' }] }],
    });
    expect(await service.sendDigests()).toBe(1);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledWith(
      'u1@example.test',
      {
        month: '2026-10',
        completedCount: 3,
        averageGrade: 15.3,
        studyMinutes: 90,
        overdueCount: 1,
        topAreaName: 'Maths',
      },
      expect.stringMatching(/\/period-review$/),
      'pt',
    );
  });

  it('only queries opted-in, verified, not banned users', async () => {
    const { service, prisma } = setup();
    await service.sendDigests();
    const [args] = prisma.user.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).toMatchObject({
      deadlineEmailReminders: true,
      emailVerifiedAt: { not: null },
      status: { not: 'BANNED' },
    });
  });

  it('scopes every data query by userId and the Lisbon month', async () => {
    const { service, prisma } = setup({
      users: [{ id: 'u1' }, { id: 'u2' }],
      data: {
        completed: {
          u1: { count: 1, avg: null },
          u2: { count: 2, avg: null },
          intruder: { count: 9, avg: 20 },
        },
        overdue: { intruder: 5 },
        sessions: [{ userId: 'intruder', minutes: 600, areaName: 'X' }],
      },
    });
    expect(await service.sendDigests()).toBe(2);
    for (const [args] of prisma.task.groupBy.mock.calls as [GroupByArgs][]) {
      expect(args.where.userId).toEqual({ in: ['u1', 'u2'] });
    }
    const [completedArgs] = prisma.task.groupBy.mock.calls[0];
    expect(completedArgs.where.completedAt).toEqual({
      gte: OCT_START,
      lt: OCT_END,
    });
    const [sessionArgs] = prisma.studySession.findMany.mock.calls[0] as [
      { where: { userId: unknown } },
    ];
    expect(sessionArgs.where.userId).toEqual({ in: ['u1', 'u2'] });
  });

  it('skips a month with nothing to report and remembers it', async () => {
    const { service, mail, prisma } = setup({
      data: { completed: {}, overdue: { u1: 4 }, sessions: [] },
    });
    expect(await service.sendDigests()).toBe(0);
    expect(mail.sendMonthlyDigestEmail).not.toHaveBeenCalled();
    jest.setSystemTime(LATER_SAME_DAY);
    expect(await service.sendDigests()).toBe(0);
    // Ja tratado: nem volta a pedir os numeros.
    expect(prisma.task.groupBy).toHaveBeenCalledTimes(2);
  });

  it('never sends twice in the same month', async () => {
    const { service, mail } = setup();
    expect(await service.sendDigests()).toBe(1);
    jest.setSystemTime(LATER_SAME_DAY);
    expect(await service.sendDigests()).toBe(0);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledTimes(1);
  });

  it('stores a durable marker for the summarized month', async () => {
    const { service, sent } = setup();
    expect(await service.sendDigests()).toBe(1);
    expect(
      sent.rows.has(
        FakeSentNotificationService.keyOf(
          'u1',
          SENT_NOTIFICATION_KIND.MONTHLY_DIGEST,
          '2026-10',
        ),
      ),
    ).toBe(true);
  });

  it('does nothing outside day 1 and sends again next month', async () => {
    const { service, prisma, mail } = setup();
    jest.setSystemTime(SECOND_DAY);
    expect(await service.sendDigests()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    jest.setSystemTime(FIRST_MORNING);
    expect(await service.sendDigests()).toBe(1);
    jest.setSystemTime(NEXT_MONTH);
    expect(await service.sendDigests()).toBe(1);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledTimes(2);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenLastCalledWith(
      'u1@example.test',
      expect.objectContaining({ month: '2026-11' }),
      expect.any(String),
      'en',
    );
  });

  it('retries on the next run when SMTP fails', async () => {
    const { service, mail } = setup({ mailOk: false });
    expect(await service.sendDigests()).toBe(0);
    mail.sendMonthlyDigestEmail.mockResolvedValue(true);
    jest.setSystemTime(LATER_SAME_DAY);
    expect(await service.sendDigests()).toBe(1);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledTimes(2);
  });

  it('overlapping runs never send twice (marked before the email)', async () => {
    const { service, mail } = setup();
    let release: (ok: boolean) => void = () => undefined;
    mail.sendMonthlyDigestEmail.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (release = resolve)),
    );
    const first = service.sendDigests();
    for (
      let i = 0;
      i < 50 && mail.sendMonthlyDigestEmail.mock.calls.length === 0;
      i++
    ) {
      await Promise.resolve();
    }
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledTimes(1);
    expect(await service.sendDigests()).toBe(0);
    release(true);
    expect(await first).toBe(1);
    expect(mail.sendMonthlyDigestEmail).toHaveBeenCalledTimes(1);
  });

  it('respects quiet hours without marking the user', async () => {
    const { service, mail } = setup({
      users: [{ id: 'u1', quietHoursStart: 22 * 60, quietHoursEnd: 10 * 60 }],
    });
    expect(await service.sendDigests()).toBe(0);
    expect(mail.sendMonthlyDigestEmail).not.toHaveBeenCalled();
    jest.setSystemTime(LATER_SAME_DAY);
    expect(await service.sendDigests()).toBe(1);
  });

  it('pages through users with an id cursor', async () => {
    const page = Array.from(
      { length: MONTHLY_DIGEST_USER_BATCH_SIZE },
      (_, i) => ({
        id: `u${String(i).padStart(4, '0')}`,
        email: `u${i}@example.test`,
        quietHoursStart: null,
        quietHoursEnd: null,
        pushSubscriptions: [],
      }),
    );
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValueOnce(page).mockResolvedValueOnce([]);
    await service.sendDigests();
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    const [second] = prisma.user.findMany.mock.calls[1] as [
      { where: { id: { gt: string } } },
    ];
    expect(second.where.id.gt).toBe(page[page.length - 1].id);
  });
});
