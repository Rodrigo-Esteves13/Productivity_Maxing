// B-33/S-17: heatmap, tempo por Area e streak agregam no Postgres. Prisma em
// mock: os testes verificam o SQL (parametrizado, com userId e o fuso da
// app) e a logica que ficou em JS sobre as linhas devolvidas.
import { Prisma } from '@prisma/client';
import { StudySessionsService } from './study-sessions.service';
import type { PrismaService } from '../prisma/prisma.service';
import { APP_TIME_ZONE } from '../common/time.constants';

const SECONDS_PER_MINUTE = 60;

function setup(rows: unknown[], freezes: { dateKey: string }[] = []) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(rows),
    streakFreeze: { findMany: jest.fn().mockResolvedValue(freezes) },
  };
  const service = new StudySessionsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

function sqlOf(mock: jest.Mock, call = 0): Prisma.Sql {
  const [query] = mock.mock.calls[call] as [Prisma.Sql];
  // Uma unica query Prisma.sql (parametrizada), nunca texto montado a mao.
  expect(typeof query.text).toBe('string');
  expect(Array.isArray(query.values)).toBe(true);
  return query;
}

// Filtro por dono + Lisboa, sempre como parametro (nunca no texto).
function expectUserScopedLisbonSql(query: Prisma.Sql, userId: string) {
  expect(query.text).toContain('"userId" = $');
  expect(query.text).toContain('"endedAt" IS NOT NULL');
  expect(query.text).toContain('AT TIME ZONE $');
  expect(query.values).toEqual(
    expect.arrayContaining([userId, 'UTC', APP_TIME_ZONE]),
  );
  expect(query.text).not.toContain(userId);
  expect(query.text).not.toContain(APP_TIME_ZONE);
}

describe('StudySessionsService.getHeatmap (SQL)', () => {
  it('groups by Lisbon weekday x hour in SQL and only buckets in JS', async () => {
    const { service, prisma } = setup([
      // Sabado 20h e 23h caem no mesmo bloco 20-24.
      {
        dayOfWeek: 6,
        hour: 20,
        totalSeconds: 30 * SECONDS_PER_MINUTE,
        sessionCount: 1,
      },
      // BigInt/Decimal (cast em falta) tambem tem de dar numero.
      {
        dayOfWeek: 6,
        hour: 23,
        totalSeconds: new Prisma.Decimal(45.6 * SECONDS_PER_MINUTE),
        sessionCount: BigInt(2),
      },
      { dayOfWeek: 1, hour: 3, totalSeconds: 59, sessionCount: 1 },
    ]);

    const grid = await service.getHeatmap('u1');

    const query = sqlOf(prisma.$queryRaw);
    expectUserScopedLisbonSql(query, 'u1');
    expect(query.text).toContain('EXTRACT(DOW FROM');
    expect(query.text).toContain('EXTRACT(HOUR FROM');
    expect(query.text).toContain('GREATEST(');

    expect(grid).toHaveLength(42);
    expect(grid.find((c) => c.dayOfWeek === 6 && c.hourBucket === 5)).toEqual({
      dayOfWeek: 6,
      hourBucket: 5,
      totalMinutes: 76,
      sessionCount: 3,
    });
    expect(grid.find((c) => c.dayOfWeek === 1 && c.hourBucket === 0)).toEqual({
      dayOfWeek: 1,
      hourBucket: 0,
      totalMinutes: 1,
      sessionCount: 1,
    });
    expect(grid.filter((c) => c.sessionCount > 0)).toHaveLength(2);
    expect(grid[0]).toEqual({
      dayOfWeek: 0,
      hourBucket: 0,
      totalMinutes: 0,
      sessionCount: 0,
    });
  });

  it('has no per-process cache: every call reads the database', async () => {
    const { service, prisma } = setup([]);
    await service.getHeatmap('u1');
    await service.getHeatmap('u1');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe('StudySessionsService.getTimeByArea (SQL)', () => {
  it('resolves the Area with COALESCE in SQL and keeps the response shape', async () => {
    const { service, prisma } = setup([
      {
        areaId: null,
        areaName: null,
        areaColorHex: null,
        totalSeconds: 10 * SECONDS_PER_MINUTE,
        sessionCount: 2,
      },
      {
        areaId: 'a1',
        areaName: 'Redes',
        areaColorHex: 'area-color',
        totalSeconds: 90.4 * SECONDS_PER_MINUTE,
        sessionCount: BigInt(3),
      },
    ]);

    const result = await service.getTimeByArea('u1');

    const query = sqlOf(prisma.$queryRaw);
    expect(query.text).toContain('COALESCE(s."areaId", t."areaId")');
    expect(query.text).toContain('LEFT JOIN "Task" t');
    expect(query.text).toContain('s."userId" = $1');
    expect(query.values).toEqual(['u1']);

    expect(result).toEqual([
      {
        areaId: 'a1',
        areaName: 'Redes',
        areaColorHex: 'area-color',
        totalMinutes: 90,
        sessionCount: 3,
      },
      {
        areaId: null,
        areaName: 'No area',
        areaColorHex: null,
        totalMinutes: 10,
        sessionCount: 2,
      },
    ]);
  });
});

describe('StudySessionsService.getStreak (SQL distinct days)', () => {
  beforeEach(() => {
    // 10:00 UTC = 11:00 em Lisboa (verao), dia 2026-07-10.
    jest.useFakeTimers({
      now: new Date('2026-07-10T10:00:00.000Z'),
      doNotFake: ['nextTick', 'queueMicrotask'],
    });
  });
  afterEach(() => jest.useRealTimers());

  it('reads distinct Lisbon day keys from SQL and walks them in JS', async () => {
    // Ordem trocada de proposito: o primeiro dia e o mais antigo.
    const { service, prisma } = setup([
      { dayKey: '2026-07-09' },
      { dayKey: '2026-07-07' },
      { dayKey: '2026-07-08' },
    ]);

    const streak = await service.getStreak('u1');

    const query = sqlOf(prisma.$queryRaw);
    expectUserScopedLisbonSql(query, 'u1');
    expect(query.text).toContain('SELECT DISTINCT to_char(');
    expect(query.values).toContain('YYYY-MM-DD');
    expect(prisma.streakFreeze.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { dateKey: true },
    });

    expect(streak).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      freezesAvailable: 0,
      freezesUsedTotal: 0,
      activeToday: false,
      atRisk: true,
      restDayToday: false,
    });
  });

  it('a claimed rest day bridges a gap and today as rest day is not at risk', async () => {
    const { service } = setup(
      [{ dayKey: '2026-07-07' }, { dayKey: '2026-07-09' }],
      [{ dateKey: '2026-07-08' }, { dateKey: '2026-07-10' }],
    );

    const streak = await service.getStreak('u1');

    expect(streak.currentStreak).toBe(2);
    expect(streak.restDayToday).toBe(true);
    expect(streak.atRisk).toBe(false);
  });

  it('no study days at all gives the empty streak', async () => {
    const { service } = setup([]);
    await expect(service.getStreak('u1')).resolves.toEqual({
      currentStreak: 0,
      longestStreak: 0,
      freezesAvailable: 0,
      freezesUsedTotal: 0,
      activeToday: false,
      atRisk: false,
      restDayToday: false,
    });
  });
});
