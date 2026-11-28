// Agregacoes SQL das sessoes de estudo: userId em todas as queries, sempre
// como parametro. Complementa study-sessions.aggregates.spec.ts.
import { Prisma } from '@prisma/client';
import {
  activeLisbonDaysSql,
  areaTotalsSql,
  lisbonWallClock,
  weekdayHourTotalsSql,
} from './study-sessions.sql';
import { StudySessionsService } from './study-sessions.service';
import type { PrismaService } from '../prisma/prisma.service';
import { APP_TIME_ZONE } from '../common/time.constants';

const EVIL = `x'; DROP TABLE "StudySession"; --`;

const builders: [string, (userId: string) => Prisma.Sql][] = [
  ['weekdayHourTotalsSql', weekdayHourTotalsSql],
  ['areaTotalsSql', areaTotalsSql],
  ['activeLisbonDaysSql', activeLisbonDaysSql],
];

describe.each(builders)('%s ownership', (_name, build) => {
  it('filters StudySession by userId as a bound parameter', () => {
    const query = build('user-1');
    expect(query.text).toMatch(/s\."userId" = \$\d+/);
    expect(query.values).toContain('user-1');
    expect(query.text).not.toContain('user-1');
  });

  it('only counts finished sessions', () => {
    expect(build('user-1').text).toContain('s."endedAt" IS NOT NULL');
  });

  it('hostile userId never reaches the SQL text', () => {
    const query = build(EVIL);
    expect(query.text).not.toContain('DROP TABLE');
    expect(query.values).toContain(EVIL);
  });

  it('different users give different parameters on identical SQL text', () => {
    const a = build('user-a');
    const b = build('user-b');
    expect(a.text).toBe(b.text);
    expect(a.values).toContain('user-a');
    expect(a.values).not.toContain('user-b');
    expect(b.values).toContain('user-b');
  });

  it('has exactly one userId filter (no unscoped branch or UNION)', () => {
    const query = build('user-1');
    expect(query.text.match(/"userId"/g)).toHaveLength(1);
    expect(query.text.toUpperCase()).not.toContain('UNION');
  });
});

describe('areaTotalsSql joins', () => {
  it('scopes through the session and never drops sessions via inner joins', () => {
    const { text } = areaTotalsSql('u1');
    expect(text).toContain('LEFT JOIN "Task"');
    expect(text).toContain('LEFT JOIN "Area"');
    expect(text).not.toMatch(/\bINNER JOIN\b/i);
  });
});

describe('lisbonWallClock', () => {
  it('binds the time zones as parameters', () => {
    const query = lisbonWallClock(Prisma.sql`s."startedAt"`);
    expect(query.values).toEqual(['UTC', APP_TIME_ZONE]);
    expect(query.text).not.toContain(APP_TIME_ZONE);
  });
});

describe('StudySessionsService aggregates edge cases', () => {
  function setup(rows: unknown[]) {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      streakFreeze: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return {
      prisma,
      service: new StudySessionsService(prisma as unknown as PrismaService),
    };
  }

  it('getHeatmap with no sessions returns an empty grid and queries by the caller', async () => {
    const { service, prisma } = setup([]);
    const grid = await service.getHeatmap('u1');
    expect(grid.length).toBeGreaterThan(0);
    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(query.values).toContain('u1');
  });

  it('getTimeByArea with no sessions returns []', async () => {
    const { service } = setup([]);
    expect(await service.getTimeByArea('u1')).toEqual([]);
  });

  it('getStreak reads the freezes of the caller only', async () => {
    const { service, prisma } = setup([]);
    await service.getStreak('u1');
    expect(prisma.streakFreeze.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(query.values).toContain('u1');
  });
});
