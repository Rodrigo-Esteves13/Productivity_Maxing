import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import {
  DUE_TODAY_DIGEST_PATH,
  DUE_TODAY_DIGEST_USER_BATCH_SIZE,
} from './due-today-reminders.constants';
import {
  DueTodayRemindersService,
  isInDueTodayDigestWindow,
} from './due-today-reminders.service';
import { FakeSentNotificationService } from './sent-notification.fake';

// Novembro: Lisboa = UTC. Hoje = 2026-11-06.
const MORNING = new Date('2026-11-06T08:15:00.000Z');
const TOO_EARLY = new Date('2026-11-06T07:45:00.000Z');
const TOO_LATE = new Date('2026-11-06T12:00:00.000Z');
const NEXT_MORNING = new Date('2026-11-07T08:15:00.000Z');

interface Opts {
  users?: {
    id: string;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  }[];
  // userId -> tasks pendentes a vencer hoje.
  dueByUser?: Record<string, number>;
  delivered?: number;
  // Marcadores duraveis partilhados (simula um restart com a mesma base).
  sent?: FakeSentNotificationService;
}

function setup(opts: Opts = {}) {
  const users = (opts.users ?? [{ id: 'u1' }]).map((u) => ({
    quietHoursStart: null,
    quietHoursEnd: null,
    ...u,
  }));
  const dueByUser = opts.dueByUser ?? { u1: 2 };
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    task: {
      // Imita o groupBy: so devolve os users pedidos no filtro userId.
      groupBy: jest.fn((args: { where: { userId: { in: string[] } } }) =>
        Promise.resolve(
          args.where.userId.in
            .filter((id) => (dueByUser[id] ?? 0) > 0)
            .map((id) => ({ userId: id, _count: { _all: dueByUser[id] } })),
        ),
      ),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const sent = opts.sent ?? new FakeSentNotificationService();
  const service = new DueTodayRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    sent.asService(),
  );
  return { service, prisma, push, sent };
}

describe('DueTodayRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MORNING);
  });
  afterEach(() => jest.useRealTimers());

  it('window starts at the morning hour and ends before afternoon', () => {
    expect(isInDueTodayDigestWindow(8 * 60 - 1)).toBe(false);
    expect(isInDueTodayDigestWindow(8 * 60)).toBe(true);
    expect(isInDueTodayDigestWindow(12 * 60)).toBe(false);
  });

  it('sends one push with the count and no task data', async () => {
    const { service, push } = setup();
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'dueTodayDigest', {
      count: 2,
      url: DUE_TODAY_DIGEST_PATH,
    });
  });

  it('only queries push users with deadline pushes on and not banned', async () => {
    const { service, prisma } = setup();
    await service.sendReminders();
    const [args] = prisma.user.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).toMatchObject({
      deadlinePushReminders: true,
      pushSubscriptions: { some: {} },
    });
    expect(args.where).toHaveProperty('status');
  });

  it('scopes the task query by userId and excludes completed tasks', async () => {
    const { service, prisma } = setup({
      users: [{ id: 'u1' }, { id: 'u2' }],
      dueByUser: { u1: 1, u2: 3, intruder: 9 },
    });
    expect(await service.sendReminders()).toBe(2);
    const [args] = prisma.task.groupBy.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).toMatchObject({
      userId: { in: ['u1', 'u2'] },
      progressStatus: { not: 'COMPLETED' },
      completedAt: null,
      isBlocked: false,
    });
  });

  it('skips users with 0 tasks due today', async () => {
    const { service, push } = setup({ dueByUser: { u1: 0 } });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('a user with 0 tasks early is counted later if a task shows up', async () => {
    const dueByUser: Record<string, number> = { u1: 0 };
    const { service, push } = setup({ dueByUser });
    expect(await service.sendReminders()).toBe(0);
    dueByUser.u1 = 1;
    jest.setSystemTime(new Date('2026-11-06T09:00:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside the morning window', async () => {
    const { service, prisma, push } = setup();
    jest.setSystemTime(TOO_EARLY);
    expect(await service.sendReminders()).toBe(0);
    jest.setSystemTime(TOO_LATE);
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('respects quiet hours', async () => {
    const { service, push, prisma } = setup({
      users: [{ id: 'u1', quietHoursStart: 22 * 60, quietHoursEnd: 9 * 60 }],
    });
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(prisma.task.groupBy).not.toHaveBeenCalled();
  });

  it('never sends twice in the same Lisbon day', async () => {
    const { service, push } = setup();
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-11-06T09:30:00.000Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('never sends twice after a restart (durable marker)', async () => {
    const first = setup();
    expect(await first.service.sendReminders()).toBe(1);
    const restarted = setup({ sent: first.sent });
    jest.setSystemTime(new Date('2026-11-06T09:30:00.000Z'));
    expect(await restarted.service.sendReminders()).toBe(0);
    expect(restarted.push.notifyUser).not.toHaveBeenCalled();
  });

  it('sends again the next day', async () => {
    const { service, push } = setup();
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(NEXT_MORNING);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('retries on the next run when no device received it', async () => {
    const { service, push } = setup({ delivered: 0 });
    expect(await service.sendReminders()).toBe(0);
    push.notifyUser.mockResolvedValue(1);
    jest.setSystemTime(new Date('2026-11-06T08:30:00.000Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('overlapping runs never send twice (marked before the push)', async () => {
    const { service, push } = setup();
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

  it('pages through users with an id cursor', async () => {
    const page = Array.from(
      { length: DUE_TODAY_DIGEST_USER_BATCH_SIZE },
      (_, i) => ({
        id: `u${String(i).padStart(4, '0')}`,
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    );
    const { service, prisma } = setup({ dueByUser: {} });
    prisma.user.findMany.mockResolvedValueOnce(page).mockResolvedValueOnce([]);
    await service.sendReminders();
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    const [second] = prisma.user.findMany.mock.calls[1] as [
      { where: { id: { gt: string } } },
    ];
    expect(second.where.id.gt).toBe(page[page.length - 1].id);
  });
});
