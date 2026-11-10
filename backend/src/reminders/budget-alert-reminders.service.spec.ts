import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import { BudgetAlertRemindersService } from './budget-alert-reminders.service';
import { MONEY_REMINDER_USER_BATCH_SIZE } from './money-reminders.service';
import { FakeSentNotificationService } from './sent-notification.fake';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

// Novembro: Lisboa = UTC. 2026-11-06 e sexta-feira.
const FRIDAY_NOON = new Date('2026-11-06T12:00:00.000Z');
const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

interface Row {
  userId: string;
  category: string;
  amountCents: number;
  date: Date;
  frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
}

// Despesa unica ja paga este mes.
const spend = (
  userId: string,
  amountCents: number,
  category = 'FOOD',
  date = '2026-11-03',
): Row => ({ userId, category, amountCents, date: day(date) });

interface User {
  id: string;
  monthly?: number | null;
  leisure?: number | null;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

interface Opts {
  users?: User[];
  rows?: Row[];
  delivered?: number;
}

function setup(opts: Opts = {}) {
  const users = (opts.users ?? [{ id: 'u1', monthly: 10_000 }]).map((u) => ({
    id: u.id,
    quietHoursStart: u.quietHoursStart ?? null,
    quietHoursEnd: u.quietHoursEnd ?? null,
    financeSettings: {
      monthlyBudgetCents: u.monthly ?? null,
      leisureBudgetCents: u.leisure ?? null,
    },
  }));
  const state = { rows: opts.rows ?? [] };
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    financeEntry: {
      findMany: jest.fn(() =>
        Promise.resolve(
          state.rows.map((r) => ({
            recurring: false,
            frequency: null,
            payDayRule: null,
            payDay: null,
            endDate: null,
            skipFirstOccurrences: 0,
            paidInArrearsMonths: 0,
            ...r,
          })),
        ),
      ),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const sent = new FakeSentNotificationService();
  const service = new BudgetAlertRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    sent.asService(),
  );
  return { service, prisma, push, state, sent };
}

describe('BudgetAlertRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FRIDAY_NOON);
  });
  afterEach(() => jest.useRealTimers());

  it('warns at 80% of the monthly budget', async () => {
    const { service, push } = setup({ rows: [spend('u1', 8_000)] });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'budgetWarn', {
      url: '/finance',
    });
  });

  it('overlapping runs never send twice (marked before the push)', async () => {
    const { service, push } = setup({ rows: [spend('u1', 8_000)] });
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

  it('0 delivered on "over" keeps an earlier "warn" marked', async () => {
    const rows = [spend('u1', 8_000)];
    const { service, push } = setup({ rows });
    expect(await service.sendReminders()).toBe(1);
    rows.push(spend('u1', 2_000));
    push.notifyUser.mockResolvedValueOnce(0);
    expect(await service.sendReminders()).toBe(0);
    // O "over" volta a tentar; o "warn" ja enviado nunca se repete.
    expect(await service.sendReminders()).toBe(1);
    const keys = (push.notifyUser.mock.calls as [string, string][]).map(
      (c) => c[1],
    );
    expect(keys).toEqual(['budgetWarn', 'budgetOver', 'budgetOver']);
  });

  it('"over" stores durable markers for both levels of the month', async () => {
    const { service, sent } = setup({ rows: [spend('u1', 10_000)] });
    expect(await service.sendReminders()).toBe(1);
    expect([...sent.rows].sort()).toEqual(
      [
        FakeSentNotificationService.keyOf(
          'u1',
          SENT_NOTIFICATION_KIND.BUDGET_TOTAL_OVER,
          '2026-11',
        ),
        FakeSentNotificationService.keyOf(
          'u1',
          SENT_NOTIFICATION_KIND.BUDGET_TOTAL_WARN,
          '2026-11',
        ),
      ].sort(),
    );
  });

  it('says over at 100% of the monthly budget', async () => {
    const { service, push } = setup({ rows: [spend('u1', 10_000)] });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'budgetOver', {
      url: '/finance',
    });
  });

  it('sends nothing below 80%', async () => {
    const { service, push } = setup({ rows: [spend('u1', 7_999)] });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('ignores projected future occurrences of a recurring expense', async () => {
    const { service, push } = setup({
      rows: [
        // Mensal, comecou em outubro: a ocorrencia deste mes e dia 20 (futura).
        { ...spend('u1', 9_000, 'FOOD', '2026-10-20'), frequency: 'MONTHLY' },
        // Despesa unica marcada para mais tarde.
        spend('u1', 9_000, 'FOOD', '2026-11-20'),
      ],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('counts a recurring occurrence that already happened this month', async () => {
    const { service, push } = setup({
      rows: [
        {
          ...spend('u1', 8_000, 'HOUSING', '2026-10-01'),
          frequency: 'MONTHLY',
        },
      ],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'budgetWarn', {
      url: '/finance',
    });
  });

  it('counts an expense dated today', async () => {
    const { service, push } = setup({
      rows: [spend('u1', 8_000, 'FOOD', '2026-11-06')],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('ignores expenses from earlier months', async () => {
    const { service, push } = setup({
      rows: [spend('u1', 20_000, 'FOOD', '2026-10-31')],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('only asks the database for real expenses (no income, no owed)', async () => {
    const { service, prisma } = setup({ rows: [spend('u1', 8_000)] });
    await service.sendReminders();
    const [arg] = prisma.financeEntry.findMany.mock.calls[0] as unknown as [
      { where: Record<string, unknown> },
    ];
    expect(arg.where).toMatchObject({
      kind: 'EXPENSE',
      isOwed: false,
      userId: { in: ['u1'] },
    });
  });

  it('tracks the leisure budget apart from the monthly one', async () => {
    const { service, push } = setup({
      users: [{ id: 'u1', monthly: 100_000, leisure: 5_000 }],
      rows: [spend('u1', 4_000, 'LEISURE'), spend('u1', 1_000, 'FOOD')],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'leisureBudgetWarn', {
      url: '/finance',
    });
  });

  it('says leisure over at 100% of the leisure budget', async () => {
    const { service, push } = setup({
      users: [{ id: 'u1', leisure: 5_000 }],
      rows: [spend('u1', 5_000, 'LEISURE')],
    });
    await service.sendReminders();
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'leisureBudgetOver', {
      url: '/finance',
    });
  });

  it('does not count non-leisure spending against the leisure budget', async () => {
    const { service, push } = setup({
      users: [{ id: 'u1', leisure: 5_000 }],
      rows: [spend('u1', 9_000, 'FOOD')],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('sends only the highest level when both thresholds are crossed at once', async () => {
    const { service, push } = setup({ rows: [spend('u1', 12_000)] });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'budgetOver', {
      url: '/finance',
    });
    // Mais tarde nao volta a avisar o nivel mais baixo.
    jest.setSystemTime(new Date('2026-11-06T15:15:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('warns first, then says over later, once each', async () => {
    const { service, push, state } = setup({ rows: [spend('u1', 8_500)] });
    expect(await service.sendReminders()).toBe(1);
    expect(await service.sendReminders()).toBe(0);
    state.rows = [spend('u1', 8_500), spend('u1', 2_000, 'FOOD', '2026-11-05')];
    expect(await service.sendReminders()).toBe(1);
    expect(await service.sendReminders()).toBe(0);
    const keys = (push.notifyUser.mock.calls as [string, string][]).map(
      (c) => c[1],
    );
    expect(keys).toEqual(['budgetWarn', 'budgetOver']);
  });

  it('never repeats a level inside the same month', async () => {
    const { service, push } = setup({ rows: [spend('u1', 9_000)] });
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('resets the dedupe in a new month', async () => {
    const { service, push, state } = setup({ rows: [spend('u1', 9_000)] });
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-12-02T12:00:00.000Z'));
    state.rows = [spend('u1', 9_000, 'FOOD', '2026-12-01')];
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a budget limit', async () => {
    const { service, push, prisma } = setup({
      users: [{ id: 'u1', monthly: null, leisure: null }],
      rows: [spend('u1', 99_000)],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(prisma.financeEntry.findMany).not.toHaveBeenCalled();
  });

  it('ignores a zero limit', async () => {
    const { service, push } = setup({
      users: [{ id: 'u1', monthly: 0 }],
      rows: [spend('u1', 100)],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('retries on the next run when no device received it', async () => {
    const { service, push } = setup({
      rows: [spend('u1', 9_000)],
      delivered: 0,
    });
    expect(await service.sendReminders()).toBe(0);
    push.notifyUser.mockResolvedValue(1);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('only sends inside the 09:00-20:00 Lisbon window', async () => {
    const { service, prisma, push } = setup({ rows: [spend('u1', 9_000)] });
    jest.setSystemTime(new Date('2026-11-06T08:59:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(new Date('2026-11-06T20:00:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-11-06T09:00:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
  });

  it('respects quiet hours (also across midnight)', async () => {
    const { service, push, prisma } = setup({
      users: [
        {
          id: 'u1',
          monthly: 10_000,
          quietHoursStart: 11 * 60,
          quietHoursEnd: 14 * 60,
        },
        {
          id: 'u2',
          monthly: 10_000,
          quietHoursStart: 20 * 60,
          quietHoursEnd: 13 * 60,
        },
      ],
      rows: [spend('u1', 9_000), spend('u2', 9_000)],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(prisma.financeEntry.findMany).not.toHaveBeenCalled();
  });

  it('batches: one entries query per page, scoped per user', async () => {
    const { service, prisma, push } = setup({
      users: [
        { id: 'u1', monthly: 10_000 },
        { id: 'u2', monthly: 10_000 },
        { id: 'u3', monthly: 10_000 },
      ],
      rows: [spend('u1', 9_000), spend('u3', 3_000)],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(prisma.financeEntry.findMany).toHaveBeenCalledTimes(1);
    const notified = (push.notifyUser.mock.calls as [string][]).map(
      (c) => c[0],
    );
    expect(notified).toEqual(['u1']);
  });

  it('never puts names or amounts in the push options', async () => {
    const { service, push } = setup({ rows: [spend('u1', 9_000)] });
    await service.sendReminders();
    const [, , options] = push.notifyUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(Object.keys(options)).toEqual(['url']);
  });

  it('only loads users with push, a budget and not banned', async () => {
    const { service, prisma } = setup({ users: [] });
    expect(await service.sendReminders()).toBe(0);
    const [arg] = prisma.user.findMany.mock.calls[0] as unknown as [
      { where: Record<string, unknown>; take: number },
    ];
    expect(arg.where).toMatchObject({
      pushSubscriptions: { some: {} },
      status: { not: 'BANNED' },
      financeSettings: {
        is: {
          OR: [
            { monthlyBudgetCents: { not: null } },
            { leisureBudgetCents: { not: null } },
          ],
        },
      },
    });
    expect(arg.take).toBe(MONEY_REMINDER_USER_BATCH_SIZE);
    expect(prisma.financeEntry.findMany).not.toHaveBeenCalled();
  });
});
