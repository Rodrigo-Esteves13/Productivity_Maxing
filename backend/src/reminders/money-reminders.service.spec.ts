import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import {
  isInMoneyReminderWindow,
  MONEY_REMINDER_USER_BATCH_SIZE,
  MoneyRemindersService,
} from './money-reminders.service';

// Novembro: Lisboa = UTC. 2026-11-06 e sexta-feira, 2026-11-09 segunda.
const FRIDAY_NOON = new Date('2026-11-06T12:00:00.000Z');
const MONDAY_NOON = new Date('2026-11-09T12:00:00.000Z');

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

interface SubRow {
  userId: string;
  date: Date;
  frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  endDate?: Date | null;
}
interface OwedRow {
  userId: string;
  expectedDate: Date;
}

// Renovacao mensal no dia 7: amanha (07/11) e dia de renovar.
const renewsTomorrow = (userId: string): SubRow => ({
  userId,
  date: day('2026-10-07'),
});
const renewsLater = (userId: string): SubRow => ({
  userId,
  date: day('2026-10-08'),
});

interface Opts {
  users?: {
    id: string;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  }[];
  subs?: SubRow[];
  owed?: OwedRow[];
  delivered?: number;
}

interface DateFilter {
  gte?: Date;
  lt?: Date;
}

function setup(opts: Opts = {}) {
  const users = (opts.users ?? [{ id: 'u1' }]).map((u) => ({
    quietHoursStart: null,
    quietHoursEnd: null,
    ...u,
  }));
  const subs = (opts.subs ?? []).map((s) => ({
    recurring: false,
    frequency: 'MONTHLY',
    payDayRule: null,
    payDay: null,
    endDate: null,
    skipFirstOccurrences: 0,
    paidInArrearsMonths: 0,
    ...s,
  }));
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    financeEntry: {
      findMany: jest.fn(
        (args: { where: { isOwed: boolean; expectedDate?: DateFilter } }) => {
          if (!args.where.isOwed) return Promise.resolve(subs);
          // Aplica o filtro de data do prazo, como a base de dados faria.
          const { gte, lt } = args.where.expectedDate ?? {};
          return Promise.resolve(
            (opts.owed ?? []).filter(
              (o) =>
                (!gte || o.expectedDate >= gte) && (!lt || o.expectedDate < lt),
            ),
          );
        },
      ),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const service = new MoneyRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
  );
  return { service, prisma, push };
}

describe('MoneyRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FRIDAY_NOON);
  });
  afterEach(() => jest.useRealTimers());

  it('pushes the count of subscriptions renewing tomorrow', async () => {
    const { service, push } = setup({
      subs: [renewsTomorrow('u1'), renewsTomorrow('u1'), renewsLater('u1')],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'moneyReminder', {
      count: 2,
      url: '/finance',
    });
  });

  it('overlapping runs never send twice (marked before the push)', async () => {
    const { service, push } = setup({ subs: [renewsTomorrow('u1')] });
    let release: (n: number) => void = () => undefined;
    push.notifyUser.mockImplementationOnce(
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    const first = service.sendReminders();
    for (let i = 0; i < 50 && push.notifyUser.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(await service.sendReminders()).toBe(0);
    release(1);
    expect(await first).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('does not push for subscriptions that renew on another day', async () => {
    const { service, push } = setup({ subs: [renewsLater('u1')] });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not push for a subscription whose rule already ended', async () => {
    const { service, push } = setup({
      subs: [{ ...renewsTomorrow('u1'), endDate: day('2026-11-06') }],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('pushes for money owed due tomorrow', async () => {
    const { service, push } = setup({
      owed: [{ userId: 'u1', expectedDate: day('2026-11-07') }],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'moneyReminder', {
      count: 1,
      url: '/finance',
    });
  });

  it('ignores money owed due today or later than tomorrow', async () => {
    const { service, push } = setup({
      owed: [
        { userId: 'u1', expectedDate: day('2026-11-06') },
        { userId: 'u1', expectedDate: day('2026-11-08') },
      ],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not nag about overdue money on days other than Monday', async () => {
    const { service, push, prisma } = setup({
      owed: [{ userId: 'u1', expectedDate: day('2026-11-01') }],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    const calls = prisma.financeEntry.findMany.mock.calls as [
      { where: { isOwed: boolean; expectedDate?: DateFilter } },
    ][];
    const owedWhere = calls.find((c) => c[0].where.isOwed)?.[0].where;
    expect(owedWhere?.expectedDate?.gte).toEqual(day('2026-11-07'));
  });

  it('includes overdue money on Mondays', async () => {
    jest.setSystemTime(MONDAY_NOON);
    const { service, push } = setup({
      owed: [
        { userId: 'u1', expectedDate: day('2026-11-01') },
        { userId: 'u1', expectedDate: day('2026-11-10') },
        // prazo hoje (segunda): nem amanha nem em atraso.
        { userId: 'u1', expectedDate: day('2026-11-09') },
      ],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'moneyReminder', {
      count: 2,
      url: '/finance',
    });
  });

  it('combines both kinds into one push per user per day', async () => {
    const { service, push } = setup({
      subs: [renewsTomorrow('u1')],
      owed: [{ userId: 'u1', expectedDate: day('2026-11-07') }],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'moneyReminder', {
      count: 2,
      url: '/finance',
    });
  });

  it('never sends twice in the same Lisbon day', async () => {
    const { service, push } = setup({ subs: [renewsTomorrow('u1')] });
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-11-06T15:15:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('can send again the next day', async () => {
    const { service, push } = setup({
      subs: [renewsTomorrow('u1')],
      owed: [{ userId: 'u1', expectedDate: day('2026-11-08') }],
    });
    expect(await service.sendReminders()).toBe(1);
    // Dia seguinte: a divida passa a "amanha" (a renovacao ja nao e).
    jest.setSystemTime(new Date('2026-11-07T12:00:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('retries on the next run when no device received it', async () => {
    const { service, push } = setup({
      subs: [renewsTomorrow('u1')],
      delivered: 0,
    });
    expect(await service.sendReminders()).toBe(0);
    push.notifyUser.mockResolvedValue(1);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('only sends inside the 09:00-20:00 Lisbon window', async () => {
    const { service, prisma, push } = setup({ subs: [renewsTomorrow('u1')] });
    jest.setSystemTime(new Date('2026-11-06T08:59:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(new Date('2026-11-06T20:00:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(isInMoneyReminderWindow(9 * 60)).toBe(true);
    expect(isInMoneyReminderWindow(20 * 60)).toBe(false);
    jest.setSystemTime(new Date('2026-11-06T09:00:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
  });

  it('uses Lisbon time in summer (UTC+1)', async () => {
    // 2026-07-15: dia 16 de renovacao amanha (mensal no dia 16).
    const { service, push } = setup({
      subs: [{ userId: 'u1', date: day('2026-06-16') }],
    });
    // 07:30 UTC = 08:30 em Lisboa: fora. 08:30 UTC = 09:30: dentro.
    jest.setSystemTime(new Date('2026-07-15T07:30:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(new Date('2026-07-15T08:30:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('respects quiet hours (also across midnight)', async () => {
    const { service, push } = setup({
      users: [
        { id: 'u1', quietHoursStart: 11 * 60, quietHoursEnd: 14 * 60 },
        { id: 'u2', quietHoursStart: 20 * 60, quietHoursEnd: 13 * 60 },
      ],
      subs: [renewsTomorrow('u1'), renewsTomorrow('u2')],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('batches: 2 finance queries per page and only notifies users with items', async () => {
    const { service, prisma, push } = setup({
      users: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
      subs: [renewsTomorrow('u1'), renewsLater('u3')],
      owed: [{ userId: 'u2', expectedDate: day('2026-11-07') }],
    });
    expect(await service.sendReminders()).toBe(2);
    const notified = (push.notifyUser.mock.calls as [string][]).map(
      (c) => c[0],
    );
    expect(notified).toEqual(['u1', 'u2']);
    expect(prisma.financeEntry.findMany).toHaveBeenCalledTimes(2);
    for (const call of prisma.financeEntry.findMany.mock.calls as unknown as [
      { where: { userId: { in: string[] } } },
    ][]) {
      expect(call[0].where.userId.in).toEqual(['u1', 'u2', 'u3']);
    }
  });

  it('never puts names or amounts in the push options', async () => {
    const { service, push } = setup({ subs: [renewsTomorrow('u1')] });
    await service.sendReminders();
    const [, , options] = push.notifyUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(Object.keys(options).sort()).toEqual(['count', 'url']);
  });

  it('only loads users with push subscriptions and not banned', async () => {
    const { service, prisma } = setup({ users: [] });
    await service.sendReminders();
    const [arg] = prisma.user.findMany.mock.calls[0] as [
      { where: Record<string, unknown>; take: number },
    ];
    expect(arg.where).toMatchObject({
      pushSubscriptions: { some: {} },
      status: { not: 'BANNED' },
    });
    expect(arg.take).toBe(MONEY_REMINDER_USER_BATCH_SIZE);
  });

  it('does not query finance when nobody is eligible (no subscription)', async () => {
    const { service, prisma, push } = setup({ users: [] });
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.financeEntry.findMany).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });
});
