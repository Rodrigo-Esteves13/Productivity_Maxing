import { NotFoundException } from '@nestjs/common';
import {
  averageRanks,
  buildByTeacher,
  buildQuadrants,
  buildRatingStats,
  spearman,
} from './area-ratings-stats.util';
import { AreaRatingsStatsService } from './area-ratings-stats.service';
import { EPSILON, RATING_STATS_MIN_SAMPLE } from './area-ratings.constants';
import type { RatingCourseRow } from './area-ratings.types';
import { MS_PER_DAY } from '../common/time.constants';
import type { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';
const MINUTE_MS = 60_000;

const row = (overrides: Partial<RatingCourseRow>): RatingCourseRow => ({
  areaId: 'a',
  areaName: 'A',
  colorHex: '#808080',
  teacherName: null,
  teacherRating: null,
  courseLiking: null,
  avgFocus: null,
  studiedMinutes: 0,
  gradeFraction: null,
  ...overrides,
});

const pairs = (xs: number[], ys: number[]): [number, number][] =>
  xs.map((x, i) => [x, ys[i]]);

describe('averageRanks', () => {
  it('gives tied values the mean of their ranks', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(averageRanks([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('treats values within EPSILON as ties', () => {
    // 0.1 + 0.2 !== 0.3 em ponto flutuante
    expect(averageRanks([0.1 + 0.2, 0.3])).toEqual([1.5, 1.5]);
    expect(averageRanks([0.1 + 0.2, 0.3, 0.5])).toEqual([1.5, 1.5, 3]);
  });
});

describe('spearman', () => {
  it('is 1 for a perfect monotonic relation and -1 for the reverse', () => {
    expect(spearman(pairs([1, 2, 3, 4, 5], [0.1, 0.3, 0.35, 0.8, 0.9])).r).toBe(
      1,
    );
    expect(spearman(pairs([1, 2, 3, 4, 5], [0.9, 0.8, 0.5, 0.2, 0.1])).r).toBe(
      -1,
    );
  });

  it('matches the textbook value 1 - 6*sum(d^2)/(n(n^2-1))', () => {
    // d = [-1, 1, -1, 1, 0] -> 1 - 6*4/120 = 0.8
    expect(spearman(pairs([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]))).toEqual({
      r: 0.8,
      n: 5,
      enough: true,
      reason: null,
    });
  });

  it('uses average ranks for ties', () => {
    // ranks x = [1, 2.5, 2.5, 4]; Pearson sobre as ordens = 4.5/sqrt(22.5)
    expect(spearman(pairs([1, 2, 2, 3], [1, 2, 3, 4])).r).toBe(0.95);
  });

  it('returns r null when one side has no variation', () => {
    expect(spearman(pairs([3, 3, 3, 3, 3], [1, 2, 3, 4, 5]))).toEqual({
      r: null,
      n: 5,
      enough: true,
      reason: 'no_variation',
    });
    expect(spearman(pairs([1, 2, 3, 4, 5], [4, 4, 4, 4, 4])).reason).toBe(
      'no_variation',
    );
  });

  it('gives reason insufficient when below the minimum sample', () => {
    expect(spearman(pairs([3, 3, 3], [1, 2, 3])).reason).toBe('insufficient');
  });

  it('returns r null below two pairs', () => {
    expect(spearman([])).toEqual({
      r: null,
      n: 0,
      enough: false,
      reason: 'insufficient',
    });
    expect(spearman([[4, 0.5]])).toEqual({
      r: null,
      n: 1,
      enough: false,
      reason: 'insufficient',
    });
  });

  it('flags enough only from the minimum sample (4 vs 5)', () => {
    expect(RATING_STATS_MIN_SAMPLE).toBe(5);
    const four = spearman(pairs([1, 2, 3, 4], [1, 2, 3, 4]));
    expect(four).toEqual({
      r: 1,
      n: 4,
      enough: false,
      reason: 'insufficient',
    });
    const five = spearman(pairs([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]));
    expect(five).toEqual({ r: 1, n: 5, enough: true, reason: null });
  });
});

describe('buildQuadrants', () => {
  // Media das notas = (0.9 + 0.8 + 0.3 + 0.2 + 0.5 + 0.54) / 6 = 0.54
  const rows = [
    row({ areaId: '1', courseLiking: 5, gradeFraction: 0.9 }),
    row({ areaId: '2', courseLiking: 4, gradeFraction: 0.3 }),
    row({ areaId: '3', courseLiking: 1, gradeFraction: 0.8 }),
    row({ areaId: '4', courseLiking: 2, gradeFraction: 0.2 }),
    row({ areaId: '5', courseLiking: 3, gradeFraction: 0.5 }),
    // Sem avaliacao: entra na media, nao nos quadrantes.
    row({ areaId: '6', gradeFraction: 0.54 }),
    // Sem nota: fora de tudo.
    row({ areaId: '7', courseLiking: 5 }),
  ];

  it('counts liked >= 4 and not liked <= 2 against the mean grade, skipping 3', () => {
    expect(buildQuadrants(rows, 'courseLiking')).toEqual({
      likedGradeHigh: 1,
      likedGradeLow: 1,
      notLikedGradeHigh: 1,
      notLikedGradeLow: 1,
    });
  });

  it('a grade equal to the mean is not high', () => {
    const equal = [
      row({ areaId: '1', teacherRating: 5, gradeFraction: 0.5 }),
      row({ areaId: '2', teacherRating: 1, gradeFraction: 0.5 }),
    ];
    expect(buildQuadrants(equal, 'teacherRating')).toEqual({
      likedGradeHigh: 0,
      likedGradeLow: 1,
      notLikedGradeHigh: 0,
      notLikedGradeLow: 1,
    });
  });
});

describe('buildQuadrants float epsilon', () => {
  it('grades 0.7, 0.7, 0.7 are all low (none strictly above the mean)', () => {
    const rows = [0.7, 0.7, 0.7].map((g, i) =>
      row({ areaId: String(i), courseLiking: 5, gradeFraction: g }),
    );
    expect(buildQuadrants(rows, 'courseLiking')).toEqual({
      likedGradeHigh: 0,
      likedGradeLow: 3,
      notLikedGradeHigh: 0,
      notLikedGradeLow: 0,
    });
  });

  it('a real difference above EPSILON is still high', () => {
    const rows = [
      row({ areaId: '1', courseLiking: 5, gradeFraction: 0.7 }),
      row({ areaId: '2', courseLiking: 5, gradeFraction: 0.7 + EPSILON * 10 }),
    ];
    expect(buildQuadrants(rows, 'courseLiking').likedGradeHigh).toBe(1);
  });
});

describe('buildByTeacher', () => {
  it('groups by teacherKey and averages only known values', () => {
    const rows = [
      row({
        areaId: '1',
        teacherName: 'Maria Silva',
        teacherRating: 4,
        gradeFraction: 0.6,
      }),
      row({
        areaId: '2',
        teacherName: '  maria   SILVA ',
        teacherRating: null,
        gradeFraction: 0.9,
      }),
      row({ areaId: '3', teacherName: 'Ana', teacherRating: 1 }),
      row({ areaId: '4', teacherRating: 5, gradeFraction: 0.1 }),
    ];
    expect(buildByTeacher(rows)).toEqual([
      { teacherName: 'Ana', courses: 1, avgRating: 1, avgGradeFraction: null },
      {
        teacherName: 'Maria Silva',
        courses: 2,
        avgRating: 4,
        avgGradeFraction: 0.75,
      },
    ]);
  });
});

describe('buildRatingStats', () => {
  it('returns empty arrays, zero quadrants and null r without data', () => {
    const empty = {
      r: null,
      n: 0,
      enough: false,
      reason: 'insufficient',
    };
    const zero = {
      likedGradeHigh: 0,
      likedGradeLow: 0,
      notLikedGradeHigh: 0,
      notLikedGradeLow: 0,
    };
    expect(buildRatingStats([])).toEqual({
      minSample: RATING_STATS_MIN_SAMPLE,
      courses: [],
      quadrants: { teacher: zero, course: zero },
      correlations: {
        teacherVsGrade: empty,
        courseVsGrade: empty,
        focusVsGrade: empty,
        courseVsFocus: empty,
      },
      byTeacher: [],
    });
  });

  it('pairs only courses that have both values', () => {
    const stats = buildRatingStats([
      row({ areaId: '1', courseLiking: 5, avgFocus: 4, gradeFraction: 0.9 }),
      row({ areaId: '2', courseLiking: 2, avgFocus: 2, gradeFraction: 0.4 }),
      row({ areaId: '3', courseLiking: 4, gradeFraction: 0.7 }),
      row({ areaId: '4', avgFocus: 3 }),
    ]);
    expect(stats.correlations.courseVsGrade).toEqual({
      r: 1,
      n: 3,
      enough: false,
      reason: 'insufficient',
    });
    expect(stats.correlations.courseVsFocus.n).toBe(2);
    expect(stats.correlations.focusVsGrade.n).toBe(2);
    expect(stats.correlations.teacherVsGrade.n).toBe(0);
  });
});

describe('AreaRatingsStatsService', () => {
  const P1 = 'period-1';

  function build(data: {
    periods?: { id: string }[];
    courseTaskAreas?: string[];
    gradedTasks?: unknown[];
    areas?: { id: string; name: string; colorHex: string }[];
    ratings?: unknown[];
    notes?: unknown[];
    sessions?: unknown[];
  }) {
    const prisma = {
      academicPeriod: {
        findMany: jest
          .fn()
          .mockImplementation((args: { select: Record<string, unknown> }) =>
            Promise.resolve(
              args.select.program
                ? (data.periods ?? []).map((p) => ({
                    ...p,
                    program: { gradeScale: '0-20' },
                  }))
                : (data.periods ?? []),
            ),
          ),
      },
      task: {
        findMany: jest
          .fn()
          .mockImplementation((args: { distinct?: string[] }) =>
            Promise.resolve(
              args.distinct
                ? (data.courseTaskAreas ?? []).map((areaId) => ({ areaId }))
                : (data.gradedTasks ?? []),
            ),
          ),
      },
      gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
      area: { findMany: jest.fn().mockResolvedValue(data.areas ?? []) },
      areaRating: { findMany: jest.fn().mockResolvedValue(data.ratings ?? []) },
      areaTeacherNote: {
        findMany: jest.fn().mockResolvedValue(data.notes ?? []),
      },
      studySession: {
        findMany: jest.fn().mockResolvedValue(data.sessions ?? []),
      },
    };
    return {
      prisma,
      service: new AreaRatingsStatsService(prisma as unknown as PrismaService),
    };
  }

  it('returns empty stats when the user has no active periods', async () => {
    const { prisma, service } = build({});
    const stats = await service.stats(USER);
    expect(stats.courses).toEqual([]);
    expect(stats.byTeacher).toEqual([]);
    expect(stats.correlations.teacherVsGrade.r).toBeNull();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.academicPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isArchived: false, program: { userId: USER } },
      }),
    );
  });

  it('404s for a periodId that is not the user', async () => {
    const { prisma, service } = build({ periods: [] });
    await expect(service.stats(USER, 'other-period')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.academicPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-period', program: { userId: USER } },
      }),
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('builds rows from the caller data only, resolving session areas via the task', async () => {
    const start = new Date('2026-10-01T10:00:00Z');
    const after = (minutes: number) =>
      new Date(start.getTime() + minutes * MINUTE_MS);
    const { prisma, service } = build({
      periods: [{ id: P1 }],
      courseTaskAreas: ['a'],
      gradedTasks: [
        {
          areaId: 'a',
          periodId: P1,
          realGrade: 15,
          weightPercentage: 100,
          title: 'Exam',
          recurrenceFrequency: null,
        },
      ],
      areas: [{ id: 'a', name: 'Algebra', colorHex: '#123456' }],
      ratings: [{ areaId: 'a', teacherRating: 5, courseLiking: 4 }],
      notes: [{ areaId: 'a', teacherName: ' Rui ' }],
      sessions: [
        {
          startedAt: start,
          endedAt: after(30),
          focusRating: 4,
          areaId: 'a',
          task: null,
        },
        {
          startedAt: start,
          endedAt: after(60),
          focusRating: 5,
          areaId: null,
          task: { areaId: 'a' },
        },
        {
          startedAt: start,
          endedAt: after(15),
          focusRating: null,
          areaId: 'a',
          task: null,
        },
      ],
    });

    const stats = await service.stats(USER, P1);

    expect(stats.courses).toEqual([
      {
        areaId: 'a',
        areaName: 'Algebra',
        colorHex: '#123456',
        teacherName: 'Rui',
        teacherRating: 5,
        courseLiking: 4,
        avgFocus: 4.5,
        studiedMinutes: 105,
        gradeFraction: 0.75,
      },
    ]);
    expect(stats.byTeacher).toEqual([
      { teacherName: 'Rui', courses: 1, avgRating: 5, avgGradeFraction: 0.75 },
    ]);

    // Nada de outros users: todas as leituras filtram pelo caller.
    const userScoped = [
      prisma.areaRating.findMany,
      prisma.areaTeacherNote.findMany,
      prisma.studySession.findMany,
      prisma.gradeComponent.findMany,
    ];
    for (const fn of userScoped) {
      for (const [args] of fn.mock.calls as [{ where: { userId: string } }][]) {
        expect(args.where.userId).toBe(USER);
      }
    }
    for (const [args] of prisma.task.findMany.mock.calls as [
      { where: { userId: string; periodId: unknown } },
    ][]) {
      expect(args.where.userId).toBe(USER);
      expect(args.where.periodId).toEqual({ in: [P1] });
    }
    expect(prisma.area.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['a'] },
          OR: [{ ownerId: null }, { ownerId: USER }],
        },
      }),
    );
  });

  describe('period-scoped sessions', () => {
    const START = new Date('2026-09-01T00:00:00Z');
    const END = new Date('2026-12-31T00:00:00Z');

    type SessionWhere = {
      userId: string;
      OR: [
        { AND: [{ task: { periodId: { in: string[] } } }, unknown] },
        {
          taskId: null;
          areaId: { in: string[] };
          OR: { startedAt: { gte: Date; lt?: Date } }[];
        },
      ];
    };

    async function whereFor(periodId?: string, endDate: Date | null = END) {
      const { prisma, service } = build({
        periods: [{ id: P1, startDate: START, endDate } as { id: string }],
        courseTaskAreas: ['a'],
        areas: [{ id: 'a', name: 'Algebra', colorHex: '#123456' }],
      });
      await service.stats(USER, periodId);
      const [args] = prisma.studySession.findMany.mock.calls[0] as [
        { where: SessionWhere },
      ];
      return args.where;
    }

    it('task-linked sessions must belong to a task in the scoped periods', async () => {
      const where = await whereFor(P1);
      expect(where.userId).toBe(USER);
      expect(where.OR[0].AND[0]).toEqual({
        task: { periodId: { in: [P1] } },
      });
    });

    it('task-less sessions are limited to the period dates (end inclusive)', async () => {
      const where = await whereFor(P1);
      const free = where.OR[1];
      expect(free.taskId).toBeNull();
      expect(free.areaId).toEqual({ in: ['a'] });
      expect(free.OR).toEqual([
        {
          startedAt: {
            gte: START,
            lt: new Date(END.getTime() + MS_PER_DAY),
          },
        },
      ]);
    });

    it('an open-ended period has no upper date bound', async () => {
      const where = await whereFor(undefined, null);
      expect(where.OR[1].OR).toEqual([{ startedAt: { gte: START } }]);
      expect(where.OR[0].AND[0]).toEqual({
        task: { periodId: { in: [P1] } },
      });
    });
  });

  it('drops courses whose area is not accessible to the caller', async () => {
    const { service } = build({
      periods: [{ id: P1 }],
      courseTaskAreas: ['someone-elses-private'],
      areas: [],
      ratings: [],
    });
    expect((await service.stats(USER)).courses).toEqual([]);
  });
});
