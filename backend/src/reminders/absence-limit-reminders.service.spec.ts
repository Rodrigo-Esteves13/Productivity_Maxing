import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import {
  AbsenceLimitRemindersService,
  isInSendWindow,
  isoWeekKey,
  USER_BATCH_SIZE,
} from './absence-limit-reminders.service';

const MONDAY = new Date('2026-10-19T10:00:00.000Z');
const NEXT_MONDAY = new Date('2026-10-26T10:00:00.000Z');
const EARLY = new Date('2026-10-19T05:00:00.000Z');

interface Row {
  subject: string;
  attended: boolean | null;
  _count: { _all: number };
}

const rows = (
  subject: string,
  attended: number,
  missed: number,
  unmarked = 0,
): Row[] => [
  { subject, attended: true, _count: { _all: attended } },
  { subject, attended: false, _count: { _all: missed } },
  { subject, attended: null, _count: { _all: unmarked } },
];

function setup(
  groups: Row[],
  user: Partial<{
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  }> = {},
  opts: { users?: boolean; delivered?: number } = {},
) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(
        opts.users === false
          ? []
          : [
              {
                id: 'u1',
                quietHoursStart: null,
                quietHoursEnd: null,
                activePeriod: null,
                ...user,
              },
            ],
      ),
    },
    classOccurrence: { groupBy: jest.fn().mockResolvedValue(groups) },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const service = new AbsenceLimitRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
  );
  return { service, prisma, push };
}

function pushedTitle(fn: jest.Mock): string {
  const calls = fn.mock.calls as [string, string, { title: string }][];
  return calls[0][2].title;
}

describe('AbsenceLimitRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('sends nothing below the near threshold', async () => {
    // 1 em 10 = 10%, abaixo de 20% (80% de 25%).
    const { service, push } = setup(rows('Math', 8, 1, 1));
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('sends one push when near the limit', async () => {
    // 2 em 10 = 20%, exatamente o limiar de "perto".
    const { service, push } = setup(rows('Math', 8, 2));
    expect(await service.sendWeeklyReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith(
      'u1',
      'absenceLimitNear',
      expect.objectContaining({ title: 'Math', url: '/schedule' }),
    );
  });

  it('sends when above the limit and groups courses in one push', async () => {
    const { service, push } = setup([
      ...rows('Math', 6, 4),
      ...rows('Physics', 7, 3),
      ...rows('Art', 9, 1),
    ]);
    await service.sendWeeklyReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    const title = pushedTitle(push.notifyUser);
    expect(title).toContain('Math');
    expect(title).toContain('Physics');
    expect(title).not.toContain('Art');
  });

  it('adds a +N suffix beyond three courses', async () => {
    const groups = ['A', 'B', 'C', 'D', 'E'].flatMap((s) => rows(s, 5, 5));
    const { service, push } = setup(groups);
    await service.sendWeeklyReminders();
    expect(pushedTitle(push.notifyUser)).toMatch(/\+2$/);
  });

  it('dedupes within the same ISO week', async () => {
    const { service, push } = setup(rows('Math', 5, 5));
    expect(await service.sendWeeklyReminders()).toBe(1);
    jest.setSystemTime(new Date('2026-10-19T15:00:00.000Z'));
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('sends again the next week', async () => {
    const { service, push } = setup(rows('Math', 5, 5));
    await service.sendWeeklyReminders();
    jest.setSystemTime(NEXT_MONDAY);
    expect(await service.sendWeeklyReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('skips users without push subscriptions (query filters them)', async () => {
    const { service, prisma, push } = setup(
      rows('Math', 5, 5),
      {},
      { users: false },
    );
    expect(await service.sendWeeklyReminders()).toBe(0);
    const args = prisma.user.findMany.mock.calls as [
      { where: { pushSubscriptions: unknown } },
    ][];
    expect(args[0][0].where.pushSubscriptions).toEqual({ some: {} });
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('retries next run when no device received the push', async () => {
    const { service, push } = setup(rows('Math', 5, 5), {}, { delivered: 0 });
    expect(await service.sendWeeklyReminders()).toBe(0);
    await service.sendWeeklyReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });

  it('respects quiet hours', async () => {
    // Lisboa ~11:00 (660 min) cai dentro de 10:00-12:00.
    const { service, push } = setup(rows('Math', 5, 5), {
      quietHoursStart: 600,
      quietHoursEnd: 720,
    });
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not send before 09:00', async () => {
    jest.setSystemTime(EARLY);
    const { service, push } = setup(rows('Math', 5, 5));
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('ignores courses without attendance records', async () => {
    const { service, push } = setup([]);
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('ignores courses with only unmarked classes', async () => {
    const { service, push } = setup(rows('Math', 0, 0, 10));
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });
});

describe('send window (Monday 09:00-21:00 Lisbon)', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    // [instante UTC, envia?, nota]
    ['2026-10-26T08:59:00.000Z', false, 'winter, 08:59 Lisbon'],
    [
      '2026-10-26T09:00:00.000Z',
      true,
      'winter, 09:00 Lisbon (day after DST end)',
    ],
    ['2026-10-26T20:59:00.000Z', true, 'winter, 20:59 Lisbon'],
    ['2026-10-26T21:00:00.000Z', false, 'winter, 21:00 Lisbon'],
    [
      '2026-03-30T07:59:00.000Z',
      false,
      'summer, 08:59 Lisbon (day after DST start)',
    ],
    ['2026-03-30T08:00:00.000Z', true, 'summer, 09:00 Lisbon'],
    ['2026-03-30T19:59:00.000Z', true, 'summer, 20:59 Lisbon'],
    ['2026-03-30T20:00:00.000Z', false, 'summer, 21:00 Lisbon'],
    ['2026-10-25T10:00:00.000Z', false, 'Sunday of DST end'],
    ['2026-10-27T10:00:00.000Z', false, 'Tuesday'],
    // 23:30Z de domingo no verao ja e segunda 00:30 em Lisboa: antes das 09:00.
    ['2026-10-18T23:30:00.000Z', false, 'Lisbon already Monday 00:30'],
  ])('%s -> %s (%s)', async (instant, expected) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(instant));
    const { service, push } = setup(rows('Math', 5, 5));
    expect(await service.sendWeeklyReminders()).toBe(expected ? 1 : 0);
    expect(push.notifyUser).toHaveBeenCalledTimes(expected ? 1 : 0);
  });

  it('isInSendWindow uses Lisbon weekday from the UTC-midnight day', () => {
    const monday = new Date('2026-10-19T00:00:00.000Z');
    expect(isInSendWindow(monday, 9 * 60)).toBe(true);
    expect(isInSendWindow(monday, 21 * 60)).toBe(false);
    expect(isInSendWindow(new Date('2026-10-20T00:00:00.000Z'), 600)).toBe(
      false,
    );
  });
});

describe('AbsenceLimitRemindersService paging, memo and guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  const mkUser = (id: string) => ({
    id,
    quietHoursStart: null,
    quietHoursEnd: null,
    activePeriod: null,
  });

  it('pages through all users beyond one batch with id cursor', async () => {
    const page1 = Array.from({ length: USER_BATCH_SIZE }, (_, i) =>
      mkUser(`a${String(i).padStart(4, '0')}`),
    );
    const page2 = [mkUser('b0001'), mkUser('b0002')];
    const { service, prisma, push } = setup(rows('Math', 5, 5));
    prisma.user.findMany
      .mockReset()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);
    expect(await service.sendWeeklyReminders()).toBe(USER_BATCH_SIZE + 2);
    expect(push.notifyUser).toHaveBeenCalledTimes(USER_BATCH_SIZE + 2);
    const calls = prisma.user.findMany.mock.calls as [
      {
        where: { id?: unknown };
        orderBy: unknown;
        take: number;
        cursor?: unknown;
        skip?: number;
      },
    ][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0].orderBy).toEqual({ id: 'asc' });
    expect(calls[0][0].where.id).toBeUndefined();
    expect(calls[1][0].where.id).toEqual({
      gt: page1[USER_BATCH_SIZE - 1].id,
    });
    // Sem cursor+skip do Prisma (ver o teste seguinte).
    expect(calls[1][0].cursor).toBeUndefined();
    expect(calls[1][0].skip).toBeUndefined();
  });

  // Fake com a semantica real do Prisma para cursor+skip (o cursor ancora pelo
  // id sem o filtro, depois salta `skip` linhas do resultado filtrado) e para
  // where.id.gt. O ultimo user da 1a pagina so tem uma subscricao morta: o
  // notifyUser apaga-a (404/410), e ele deixa de cumprir o filtro.
  it('does not skip the next user when the last one of a page loses its push subscription', async () => {
    const ids = Array.from(
      { length: USER_BATCH_SIZE + 3 },
      (_, i) => `u${String(i).padStart(4, '0')}`,
    );
    const subscribed = new Set(ids);
    const lastOfPage = ids[USER_BATCH_SIZE - 1];
    const { service, prisma, push } = setup(rows('Math', 5, 5));
    prisma.user.findMany.mockReset().mockImplementation(
      (args: {
        where: { id?: { gt: string } };
        take: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        let list = ids.filter((id) => subscribed.has(id));
        if (args.where.id) list = list.filter((id) => id > args.where.id!.gt);
        if (args.cursor) {
          const anchor = ids.includes(args.cursor.id) ? args.cursor.id : null;
          list = anchor ? list.filter((id) => id >= anchor) : [];
          list = list.slice(args.skip ?? 0);
        }
        return Promise.resolve(list.slice(0, args.take).map(mkUser));
      },
    );
    push.notifyUser.mockImplementation((userId: string) => {
      if (userId === lastOfPage) {
        subscribed.delete(userId);
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    await service.sendWeeklyReminders();

    const notified = (push.notifyUser.mock.calls as [string][]).map(
      ([userId]) => userId,
    );
    expect(notified).toEqual(ids);
  });

  it('skips no-risk users for the rest of the day (memo)', async () => {
    const { service, prisma } = setup(rows('Math', 9, 0, 1));
    await service.sendWeeklyReminders();
    expect(prisma.classOccurrence.groupBy).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date('2026-10-19T14:00:00.000Z'));
    await service.sendWeeklyReminders();
    expect(prisma.classOccurrence.groupBy).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates no-risk users on a new day', async () => {
    const { service, prisma } = setup(rows('Math', 9, 0, 1));
    await service.sendWeeklyReminders();
    jest.setSystemTime(NEXT_MONDAY);
    await service.sendWeeklyReminders();
    expect(prisma.classOccurrence.groupBy).toHaveBeenCalledTimes(2);
  });

  it('does not memo quiet-hour or undelivered users', async () => {
    const { service, prisma } = setup(rows('Math', 5, 5), {}, { delivered: 0 });
    await service.sendWeeklyReminders();
    await service.sendWeeklyReminders();
    expect(prisma.classOccurrence.groupBy).toHaveBeenCalledTimes(2);
  });

  it('in-memory week map blocks a second send in the same process', async () => {
    const { service, push } = setup(rows('Math', 5, 5));
    await service.sendWeeklyReminders();
    jest.setSystemTime(new Date('2026-10-19T18:00:00.000Z'));
    await service.sendWeeklyReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('does not alert with fewer than the minimum held classes', async () => {
    // 1 falta em 1 aula = 100%, mas amostra pequena.
    const { service, push } = setup(rows('Math', 0, 1));
    expect(await service.sendWeeklyReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });
});

describe('isoWeekKey', () => {
  it('uses the ISO year and week', () => {
    expect(isoWeekKey(new Date('2026-10-19T00:00:00.000Z'))).toBe('2026-W43');
    expect(isoWeekKey(new Date('2026-10-25T00:00:00.000Z'))).toBe('2026-W43');
    expect(isoWeekKey(new Date('2026-10-26T00:00:00.000Z'))).toBe('2026-W44');
    expect(isoWeekKey(new Date('2027-01-01T00:00:00.000Z'))).toBe('2026-W53');
  });

  it.each([
    // [dia, semana ISO esperada] em volta das viragens de ano
    ['2026-12-28', '2026-W53'], // segunda da ultima semana de 2026
    ['2026-12-31', '2026-W53'], // quinta: decide o ano da semana
    ['2027-01-03', '2026-W53'], // domingo ainda e da semana 53 de 2026
    ['2027-01-04', '2027-W01'], // segunda: primeira semana de 2027
    ['2025-12-29', '2026-W01'], // segunda de dezembro ja na W01 de 2026
    ['2024-12-30', '2025-W01'],
    ['2021-01-03', '2020-W53'],
    ['2020-12-31', '2020-W53'],
    ['2028-01-01', '2027-W52'], // sabado: 2027 so tem 52 semanas
    ['2028-01-03', '2028-W01'],
  ])('%s is %s', (day, expected) => {
    expect(isoWeekKey(new Date(`${day}T00:00:00.000Z`))).toBe(expected);
  });

  it('a whole Monday-Sunday week shares one key (dedupe unit)', () => {
    const keys = new Set(
      Array.from({ length: 7 }, (_, i) =>
        isoWeekKey(new Date(Date.UTC(2026, 11, 28 + i))),
      ),
    );
    expect([...keys]).toEqual(['2026-W53']);
  });
});
