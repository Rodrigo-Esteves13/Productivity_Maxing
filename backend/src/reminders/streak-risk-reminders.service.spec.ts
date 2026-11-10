import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import {
  isInStreakRiskWindow,
  STREAK_RISK_MIN_DAYS,
  STREAK_RISK_USER_BATCH_SIZE,
  StreakRiskRemindersService,
} from './streak-risk-reminders.service';
import { FakeSentNotificationService } from './sent-notification.fake';

// Novembro: Lisboa = UTC. Hoje = 2026-11-06.
const EVENING = new Date('2026-11-06T20:30:00.000Z');
const TOO_EARLY = new Date('2026-11-06T19:30:00.000Z');
const TOO_LATE = new Date('2026-11-06T22:00:00.000Z');
const NEXT_EVENING = new Date('2026-11-07T20:30:00.000Z');

const dayAt = (daysAgo: number) =>
  new Date(Date.UTC(2026, 10, 6 - daysAgo, 12, 0, 0));

// Sessoes nos ultimos `n` dias ANTES de hoje (ontem, anteontem, ...).
const lastDays = (userId: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    userId,
    startedAt: dayAt(i + 1),
  }));

interface Opts {
  users?: {
    id: string;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  }[];
  history?: { userId: string; startedAt: Date }[];
  sessionsToday?: string[];
  // Sessoes de hoje ainda a decorrer (endedAt null).
  activeToday?: string[];
  tasksToday?: string[];
  // Dias de descanso pedidos (StreakFreeze).
  freezes?: { userId: string; dateKey: string }[];
  delivered?: number;
}

function setup(opts: Opts = {}) {
  const users = (opts.users ?? [{ id: 'u1' }]).map((u) => ({
    quietHoursStart: null,
    quietHoursEnd: null,
    ...u,
  }));
  const history = opts.history ?? lastDays('u1', STREAK_RISK_MIN_DAYS);
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    studySession: {
      findMany: jest.fn((args: { where: { startedAt?: unknown } }) =>
        Promise.resolve(
          args.where.startedAt
            ? [
                ...(opts.sessionsToday ?? []).map((userId) => ({
                  userId,
                  endedAt: dayAt(0),
                })),
                ...(opts.activeToday ?? []).map((userId) => ({
                  userId,
                  endedAt: null,
                })),
              ]
            : history,
        ),
      ),
    },
    task: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (opts.tasksToday ?? []).map((userId) => ({ userId })),
        ),
    },
    streakFreeze: {
      findMany: jest.fn().mockResolvedValue(opts.freezes ?? []),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const sent = new FakeSentNotificationService();
  const service = new StreakRiskRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    sent.asService(),
  );
  return { service, prisma, push, sent };
}

describe('StreakRiskRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(EVENING);
  });
  afterEach(() => jest.useRealTimers());

  it('sends one push when the streak is at risk', async () => {
    const { service, push } = setup();
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'streakRisk', {
      count: STREAK_RISK_MIN_DAYS,
      url: '/focus',
    });
  });

  it('does not send when a study session was completed today', async () => {
    const { service, push } = setup({ sessionsToday: ['u1'] });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('a task completed today does not save the streak, so it still sends', async () => {
    const { service, push, prisma } = setup({ tasksToday: ['u1'] });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('does not send while a study session started today is in progress', async () => {
    const { service, push, prisma } = setup({ activeToday: ['u1'] });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    // A query de hoje inclui sessoes por terminar (sem filtro de endedAt).
    const [todayArgs] = prisma.studySession.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(todayArgs.where).not.toHaveProperty('endedAt');
  });

  it('an in-progress session is not settled: discarded later, it still sends', async () => {
    const opts: Opts = { activeToday: ['u1'] };
    const { service, push } = setup(opts);
    expect(await service.sendReminders()).toBe(0);
    // Descartou a sessao: na execucao seguinte a streak volta a estar em risco.
    opts.activeToday = [];
    jest.setSystemTime(new Date('2026-11-06T20:45:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('overlapping runs never send twice (marked before the push)', async () => {
    const { service, push } = setup();
    let release: (n: number) => void = () => undefined;
    push.notifyUser.mockImplementationOnce(
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    const first = service.sendReminders();
    // Deixa a primeira execucao chegar ao notifyUser.
    for (let i = 0; i < 50 && push.notifyUser.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(await service.sendReminders()).toBe(0);
    release(1);
    expect(await first).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('does not send when the streak is below the minimum', async () => {
    const { service, push } = setup({
      history: lastDays('u1', STREAK_RISK_MIN_DAYS - 1),
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not send when a banked freeze would cover today', async () => {
    // 7 dias seguidos ganham 1 freeze: falhar hoje nao parte a streak.
    const { service, push } = setup({ history: lastDays('u1', 7) });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not send when today is a claimed rest day', async () => {
    const { service, push, prisma } = setup({
      freezes: [{ userId: 'u1', dateKey: '2026-11-06' }],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    // Resolvido no dia: nem chega a carregar o historico.
    expect(prisma.studySession.findMany).toHaveBeenCalledTimes(1);
    const [freezeArgs] = prisma.streakFreeze.findMany.mock.calls[0] as [
      { where: { userId: { in: string[] } } },
    ];
    expect(freezeArgs.where.userId.in).toEqual(['u1']);
  });

  it('a past rest day bridges the gap, so the streak is still at risk', async () => {
    // Estudou 2, 3 e 4 dias atras; ontem (05) foi dia de descanso.
    const { service, push } = setup({
      history: [2, 3, 4].map((d) => ({ userId: 'u1', startedAt: dayAt(d) })),
      freezes: [{ userId: 'u1', dateKey: '2026-11-05' }],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'streakRisk', {
      count: 3,
      url: '/focus',
    });
  });

  it('does not send when the streak is already broken', async () => {
    const { service, push } = setup({
      history: [
        { userId: 'u1', startedAt: dayAt(4) },
        { userId: 'u1', startedAt: dayAt(5) },
        { userId: 'u1', startedAt: dayAt(6) },
      ],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('never sends twice in the same Lisbon day', async () => {
    const { service, push } = setup();
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-11-06T21:15:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('sends again the next day', async () => {
    const history = lastDays('u1', STREAK_RISK_MIN_DAYS);
    const { service, push } = setup({ history });
    expect(await service.sendReminders()).toBe(1);
    // Estudou hoje (06) e falha amanha (07): nova streak de 4, novo dia.
    history.push({ userId: 'u1', startedAt: dayAt(0) });
    jest.setSystemTime(NEXT_EVENING);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('retries on the next run when no device received it', async () => {
    const { service, push } = setup({ delivered: 0 });
    expect(await service.sendReminders()).toBe(0);
    push.notifyUser.mockResolvedValue(1);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('only sends inside the 20:00-22:00 Lisbon window', async () => {
    const { service, prisma, push } = setup();
    jest.setSystemTime(TOO_EARLY);
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(TOO_LATE);
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(isInStreakRiskWindow(20 * 60)).toBe(true);
    expect(isInStreakRiskWindow(22 * 60)).toBe(false);
  });

  it('uses Lisbon time in summer (UTC+1)', async () => {
    const { service, push } = setup({
      history: [1, 2, 3].map((d) => ({
        userId: 'u1',
        startedAt: new Date(Date.UTC(2026, 6, 15 - d, 12, 0, 0)),
      })),
    });
    // 18:30 UTC = 19:30 em Lisboa: fora. 19:30 UTC = 20:30: dentro.
    jest.setSystemTime(new Date('2026-07-15T18:30:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(new Date('2026-07-15T19:30:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('respects quiet hours (also across midnight)', async () => {
    const { service, push } = setup({
      users: [
        { id: 'u1', quietHoursStart: 20 * 60, quietHoursEnd: 23 * 60 },
        { id: 'u2', quietHoursStart: 20 * 60, quietHoursEnd: 8 * 60 },
      ],
      history: [...lastDays('u1', 3), ...lastDays('u2', 3)],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('batches: 2 queries per page and only notifies users at risk', async () => {
    const { service, prisma, push } = setup({
      users: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
      history: [
        ...lastDays('u1', 3),
        ...lastDays('u2', 3),
        ...lastDays('u3', 1),
      ],
      sessionsToday: ['u2'],
    });
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    const notified = push.notifyUser.mock.calls as [string][];
    expect(notified[0][0]).toBe('u1');
    // sessoes de hoje + historico, uma vez para a pagina toda.
    expect(prisma.studySession.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    // Todas as queries por utilizador ficam limitadas aos candidatos.
    const idsOf = (fn: jest.Mock, call: number) =>
      (fn.mock.calls[call] as [{ where: { userId: { in: string[] } } }])[0]
        .where.userId.in;
    expect(idsOf(prisma.studySession.findMany, 0)).toEqual(['u1', 'u2', 'u3']);
    expect(idsOf(prisma.studySession.findMany, 1)).toEqual(['u1', 'u3']);
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
    expect(arg.take).toBe(STREAK_RISK_USER_BATCH_SIZE);
  });
});
