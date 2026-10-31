import { NotFoundException } from '@nestjs/common';
import type {
  CourseRisk,
  CourseRiskInput,
} from '../approval-rules/approval-rules.types';
import { CourseRiskService } from './course-risk.service';
import { computeCourseRisk } from '../approval-rules/risk-engine';
import { MIN_GRADED_WEIGHT_PCT } from './course-risk.constants';

jest.mock('../approval-rules/risk-engine', () => ({
  computeCourseRisk: jest.fn(),
}));
jest.mock('../approval-rules/approval-rules.service', () => ({
  ApprovalRulesService: class {},
}));

const engine = computeCourseRisk as jest.MockedFunction<
  typeof computeCourseRisk
>;

const USER_A = 'user-a';
const USER_B = 'user-b';
const PERIOD = {
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: null,
};

const RULES = { presetKey: 'test' } as unknown as CourseRiskInput['rules'];

interface TaskRow {
  userId: string;
  areaId: string;
  periodId: string | null;
  title: string;
  date: Date;
  completedAt: Date | null;
  weightPercentage: number | null;
  realGrade: number | null;
  recurrenceFrequency: string | null;
  estimatedMinutes: number | null;
  recalledStudyMinutes: number | null;
  postponedCount: number;
  period: typeof PERIOD;
  studySessions: { startedAt: Date; endedAt: Date | null }[];
}

const task = (over: Partial<TaskRow>): TaskRow => ({
  userId: USER_A,
  areaId: 'area-1',
  periodId: 'p1',
  title: 'Exam',
  date: new Date('2020-01-01T00:00:00.000Z'),
  completedAt: null,
  weightPercentage: 50,
  realGrade: 12,
  recurrenceFrequency: null,
  estimatedMinutes: null,
  recalledStudyMinutes: null,
  postponedCount: 0,
  period: PERIOD,
  studySessions: [],
  ...over,
});

interface Db {
  tasks: TaskRow[];
  components: Record<string, unknown>[];
  areas: { id: string; name: string; colorHex: string }[];
  periods: { id: string; userId: string }[];
  links: { userId: string; areaId: string; scheduleSubject: string }[];
  occurrences: {
    subject: string;
    attended: boolean | null;
    _count: { _all: number };
  }[];
}

function build(db: Db) {
  // Filtra por userId (e periodId, quando e uma string) como o Prisma real faria.
  const matchesPeriod = (rowPeriodId: unknown, wanted: unknown) =>
    typeof wanted !== 'string' || rowPeriodId === wanted;
  const prisma = {
    task: {
      findMany: jest.fn(
        ({ where }: { where: { userId: string; periodId?: unknown } }) =>
          Promise.resolve(
            db.tasks.filter(
              (t) =>
                t.userId === where.userId &&
                matchesPeriod(t.periodId, where.periodId),
            ),
          ),
      ),
    },
    gradeComponent: {
      findMany: jest.fn(
        ({ where }: { where: { userId: string; periodId?: unknown } }) =>
          Promise.resolve(
            db.components.filter(
              (c) =>
                c['userId'] === where.userId &&
                matchesPeriod(c['periodId'], where.periodId),
            ),
          ),
      ),
    },
    academicPeriod: {
      // A posse vem de program.userId, como no Prisma real.
      findFirst: jest.fn(
        ({ where }: { where: { id: string; program: { userId: string } } }) =>
          Promise.resolve(
            db.periods.find(
              (p) => p.id === where.id && p.userId === where.program.userId,
            ) ?? null,
          ),
      ),
    },
    area: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(db.areas.filter((a) => where.id.in.includes(a.id))),
      ),
    },
    areaScheduleLink: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(db.links.filter((l) => l.userId === where.userId)),
      ),
    },
    classOccurrence: {
      groupBy: jest.fn(() => Promise.resolve(db.occurrences)),
    },
  };
  const approvalRules = {
    resolveRulesForAreas: jest.fn((_userId: string, areaIds: string[]) =>
      Promise.resolve(
        new Map(
          areaIds.map((id) => [
            id,
            { rules: RULES, source: 'preset', programId: null },
          ]),
        ),
      ),
    ),
  };
  const areaTeachers = {
    teacherStatsForUser: jest.fn(() => Promise.resolve(new Map())),
  };
  const service = new CourseRiskService(
    prisma as never,
    approvalRules as never,
    areaTeachers as never,
  );
  return { service, prisma, approvalRules, areaTeachers };
}

const emptyDb = (): Db => ({
  tasks: [],
  components: [],
  areas: [{ id: 'area-1', name: 'Maths', colorHex: '#111111' }],
  periods: [
    { id: 'p1', userId: USER_A },
    { id: 'p2', userId: USER_A },
    { id: 'p-b', userId: USER_B },
  ],
  links: [],
  occurrences: [],
});

const fakeRisk = (
  input: CourseRiskInput,
  score: number,
  over: Partial<CourseRisk> = {},
): CourseRisk => ({
  areaId: input.areaId,
  areaName: input.areaName,
  colorHex: input.colorHex,
  score,
  level: 'low',
  track: 'CONTINUOUS',
  reasons: [],
  currentAverage: null,
  gradedWeightPct: 100,
  remainingWeightPct: 0,
  neededOnRemaining: null,
  ...over,
});

describe('CourseRiskService', () => {
  beforeEach(() => {
    engine.mockReset();
    engine.mockImplementation((input) => fakeRisk(input, 10));
  });

  it('returns [] when the user has no graded data', async () => {
    const { service, prisma } = build(emptyDb());
    await expect(service.list(USER_A)).resolves.toEqual([]);
    expect(engine).not.toHaveBeenCalled();
    expect(prisma.area.findMany).not.toHaveBeenCalled();
  });

  it('ignores courses with tasks but nothing weighted or graded', async () => {
    const db = emptyDb();
    db.tasks = [task({ weightPercentage: null, realGrade: null })];
    const { service } = build(db);
    await expect(service.list(USER_A)).resolves.toEqual([]);
  });

  it('skips a course whose graded weight is below MIN_GRADED_WEIGHT_PCT', async () => {
    const db = emptyDb();
    db.tasks = [task({})];
    engine.mockImplementation((input) =>
      fakeRisk(input, 60, { gradedWeightPct: MIN_GRADED_WEIGHT_PCT - 1 }),
    );
    const { service } = build(db);
    await expect(service.list(USER_A)).resolves.toEqual([]);
  });

  it('keeps a course at exactly MIN_GRADED_WEIGHT_PCT', async () => {
    const db = emptyDb();
    db.tasks = [task({})];
    engine.mockImplementation((input) =>
      fakeRisk(input, 60, { gradedWeightPct: MIN_GRADED_WEIGHT_PCT }),
    );
    const { service } = build(db);
    await expect(service.list(USER_A)).resolves.toHaveLength(1);
  });

  it.each(['COMPONENT_BELOW_MIN', 'TOO_MANY_BELOW_SECOND_THRESHOLD'] as const)(
    'keeps a low-evidence course when the hard rule %s is violated',
    async (code) => {
      const db = emptyDb();
      db.tasks = [task({})];
      engine.mockImplementation((input) =>
        fakeRisk(input, 60, {
          gradedWeightPct: 5,
          reasons: [{ code, params: {} }],
        }),
      );
      const { service } = build(db);
      await expect(service.list(USER_A)).resolves.toHaveLength(1);
    },
  );

  it('still skips a low-evidence course with only soft reasons', async () => {
    const db = emptyDb();
    db.tasks = [task({})];
    engine.mockImplementation((input) =>
      fakeRisk(input, 60, {
        gradedWeightPct: 5,
        reasons: [{ code: 'POSTPONED_TASKS', params: {} }],
      }),
    );
    const { service } = build(db);
    await expect(service.list(USER_A)).resolves.toEqual([]);
  });

  it('scopes every query by the authenticated user', async () => {
    const db = emptyDb();
    db.tasks = [task({})];
    db.links = [{ userId: USER_A, areaId: 'area-1', scheduleSubject: 'MAT' }];
    const { service, prisma, approvalRules, areaTeachers } = build(db);

    await service.list(USER_A);

    const whereOf = (fn: jest.Mock) =>
      (fn.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereOf(prisma.task.findMany)).toMatchObject({ userId: USER_A });
    expect(whereOf(prisma.gradeComponent.findMany)).toMatchObject({
      userId: USER_A,
    });
    expect(whereOf(prisma.areaScheduleLink.findMany)).toMatchObject({
      userId: USER_A,
    });
    expect(whereOf(prisma.classOccurrence.groupBy)).toMatchObject({
      userId: USER_A,
      cancelled: false,
    });
    expect(whereOf(prisma.area.findMany)).toMatchObject({
      OR: [{ ownerId: null }, { ownerId: USER_A }],
    });
    expect(approvalRules.resolveRulesForAreas).toHaveBeenCalledWith(USER_A, [
      'area-1',
    ]);
    expect(areaTeachers.teacherStatsForUser).toHaveBeenCalledWith(USER_A);
  });

  it('only filters non archived periods', async () => {
    const { service, prisma } = build(emptyDb());
    await service.list(USER_A);
    const taskWhere = (
      prisma.task.findMany.mock.calls[0] as unknown as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(taskWhere['period']).toEqual({ isArchived: false });
  });

  it('scopes tasks and components to the requested period', async () => {
    const db = emptyDb();
    db.tasks = [
      task({ periodId: 'p1', title: 'Old exam' }),
      task({ periodId: 'p2', title: 'New exam' }),
    ];
    db.components = [
      {
        userId: USER_A,
        areaId: 'area-1',
        periodId: 'p1',
        name: 'Old seminar',
        weightPercentage: 20,
        aggregation: 'AVERAGE',
        bestOfCount: null,
        entries: [{ grade: 10 }],
        period: PERIOD,
      },
    ];
    const { service, prisma } = build(db);

    await service.list(USER_A, undefined, 'p2');

    expect(engine).toHaveBeenCalledTimes(1);
    const input = engine.mock.calls[0][0];
    expect(input.components.map((c) => c.label)).toEqual(['New exam']);
    const whereOf = (fn: jest.Mock) =>
      (fn.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereOf(prisma.task.findMany)).toMatchObject({
      userId: USER_A,
      periodId: 'p2',
    });
    expect(whereOf(prisma.gradeComponent.findMany)).toMatchObject({
      userId: USER_A,
      periodId: 'p2',
    });
    expect(whereOf(prisma.academicPeriod.findFirst)).toEqual({
      id: 'p2',
      program: { userId: USER_A },
    });
  });

  it('returns [] for an owned period with nothing graded', async () => {
    const db = emptyDb();
    db.tasks = [task({ periodId: 'p1' })];
    const { service } = build(db);
    await expect(service.list(USER_A, undefined, 'p2')).resolves.toEqual([]);
  });

  it("rejects another user's period with 404 and reads no data", async () => {
    const db = emptyDb();
    db.tasks = [task({ userId: USER_B, periodId: 'p-b' })];
    const { service, prisma } = build(db);

    await expect(service.list(USER_A, undefined, 'p-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.list(USER_A, undefined, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.gradeComponent.findMany).not.toHaveBeenCalled();
  });

  it('does not look up a period when none is requested', async () => {
    const { service, prisma } = build(emptyDb());
    await service.list(USER_A);
    expect(prisma.academicPeriod.findFirst).not.toHaveBeenCalled();
  });

  it("excludes another user's data from the result and the engine input", async () => {
    const db = emptyDb();
    db.areas.push({ id: 'area-2', name: 'Physics', colorHex: '#222222' });
    db.tasks = [
      task({}),
      task({ userId: USER_B, areaId: 'area-2', title: 'Secret' }),
    ];
    const { service } = build(db);

    const result = await service.list(USER_A);

    expect(result.map((r) => r.areaId)).toEqual(['area-1']);
    expect(engine).toHaveBeenCalledTimes(1);
    const input = engine.mock.calls[0][0];
    expect(input.areaId).toBe('area-1');
    expect(input.components.map((c) => c.label)).toEqual(['Exam']);
  });

  it('drops nulls from the engine and sorts by score descending', async () => {
    const db = emptyDb();
    db.areas = [
      { id: 'area-1', name: 'Low', colorHex: '#111111' },
      { id: 'area-2', name: 'High', colorHex: '#222222' },
      { id: 'area-3', name: 'Skipped', colorHex: '#333333' },
    ];
    db.tasks = [
      task({ areaId: 'area-1' }),
      task({ areaId: 'area-2' }),
      task({ areaId: 'area-3' }),
    ];
    const scores: Record<string, number | null> = {
      Low: 20,
      High: 80,
      Skipped: null,
    };
    engine.mockImplementation((input) => {
      const score = scores[input.areaName];
      return score === null ? null : fakeRisk(input, score);
    });
    const { service } = build(db);

    const result = await service.list(USER_A);
    expect(result.map((r) => r.areaName)).toEqual(['High', 'Low']);
  });

  it('skips areas the user cannot access (not returned by the area query)', async () => {
    const db = emptyDb();
    db.areas = [];
    db.tasks = [task({})];
    const { service } = build(db);
    await expect(service.list(USER_A)).resolves.toEqual([]);
    expect(engine).not.toHaveBeenCalled();
  });

  it('keeps the riskiest period when a course spans two active periods', async () => {
    const db = emptyDb();
    db.tasks = [task({ periodId: 'p1' }), task({ periodId: 'p2' })];
    let call = 0;
    engine.mockImplementation((input) =>
      fakeRisk(input, call++ === 0 ? 30 : 70),
    );
    const { service } = build(db);
    const result = await service.list(USER_A);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(70);
  });

  it('feeds study time, postponements, absence and the limit to the engine', async () => {
    const db = emptyDb();
    db.tasks = [
      task({
        estimatedMinutes: 120,
        recalledStudyMinutes: 30,
        postponedCount: 2,
      }),
      task({ title: 'Quiz', postponedCount: 1 }),
    ];
    db.links = [{ userId: USER_A, areaId: 'area-1', scheduleSubject: 'MAT' }];
    db.occurrences = [
      { subject: 'MAT', attended: true, _count: { _all: 6 } },
      { subject: 'MAT', attended: false, _count: { _all: 2 } },
    ];
    const { service } = build(db);

    await service.list(USER_A, 40);

    const input = engine.mock.calls[0][0];
    expect(input.studiedMinutes).toBe(30);
    expect(input.estimatedMinutes).toBe(120);
    expect(input.postponedCount).toBe(3);
    expect(input.absenceSharePct).toBe(25);
    expect(input.absenceLimitPct).toBe(40);
    expect(input.teacher).toBeNull();
  });

  it('uses the default absence limit and null absence without linked classes', async () => {
    const db = emptyDb();
    db.tasks = [task({})];
    const { service, prisma } = build(db);

    await service.list(USER_A);

    const input = engine.mock.calls[0][0];
    expect(input.absenceSharePct).toBeNull();
    expect(input.absenceLimitPct).toBe(25);
    expect(prisma.classOccurrence.groupBy).not.toHaveBeenCalled();
  });

  it('passes the teacher stats of each course to the engine', async () => {
    const db = emptyDb();
    db.areas.push({ id: 'area-2', name: 'Physics', colorHex: '#222222' });
    db.tasks = [task({}), task({ areaId: 'area-2' })];
    const { service, areaTeachers } = build(db);
    const stats = {
      name: 'Dr. Silva',
      avgWithTeacher: 0.4,
      avgOthers: 0.7,
      sampleWithTeacher: 3,
    };
    areaTeachers.teacherStatsForUser.mockResolvedValue(
      new Map([['area-1', stats]]) as never,
    );

    await service.list(USER_A);

    const teacherByArea = new Map(
      engine.mock.calls.map(([input]) => [input.areaId, input.teacher]),
    );
    expect(teacherByArea.get('area-1')).toEqual(stats);
    expect(teacherByArea.get('area-2')).toBeNull();
  });

  it('includes grade components in the engine input', async () => {
    const db = emptyDb();
    db.components = [
      {
        userId: USER_A,
        areaId: 'area-1',
        periodId: 'p1',
        name: 'Seminars',
        weightPercentage: 20,
        aggregation: 'AVERAGE',
        bestOfCount: null,
        entries: [{ grade: 10 }, { grade: 14 }],
        period: PERIOD,
      },
      {
        userId: USER_B,
        areaId: 'area-1',
        periodId: 'p1',
        name: 'Other',
        weightPercentage: 20,
        aggregation: 'AVERAGE',
        bestOfCount: null,
        entries: [{ grade: 1 }],
        period: PERIOD,
      },
    ];
    const { service } = build(db);

    await service.list(USER_A);

    expect(engine.mock.calls[0][0].components).toEqual([
      { label: 'Seminars', weightPct: 20, grade: 12 },
    ]);
  });
});
