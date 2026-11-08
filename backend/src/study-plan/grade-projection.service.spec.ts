import { GradeProjectionService } from './grade-projection.service';
import { gradeToFraction } from './grade-projection.util';
import { loadGradedHistory } from './graded-history.loader';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudyPlanService } from './study-plan.service';

jest.mock('./study-plan.service', () => ({
  ESTIMABLE_TASK_SELECT: { id: true },
  StudyPlanService: class {},
}));
jest.mock('./graded-history.loader', () => ({
  loadGradedHistory: jest.fn(),
}));
jest.mock('./grade-projection.util', () => {
  const actual = jest.requireActual<typeof import('./grade-projection.util')>(
    './grade-projection.util',
  );
  return { ...actual, gradeToFraction: jest.fn(actual.gradeToFraction) };
});

const USER = 'user-1';
const history = jest.mocked(loadGradedHistory);
const toFraction = jest.mocked(gradeToFraction);

const graded = (id: string, realGrade: number) => ({
  id,
  title: id,
  areaId: 'a',
  areaName: 'Maths',
  areaColorHex: '#111111',
  date: new Date('2026-10-01T00:00:00.000Z'),
  realGrade,
  gradeScale: '0-20',
  recalledStudyMinutes: 60,
  sessions: [],
});

function build(roundedIds: string[]) {
  const findMany = jest.fn(({ select }: { select: Record<string, unknown> }) =>
    // Pending tasks query -> nothing pending; rounding query -> flagged ids.
    Promise.resolve(
      'targetGrade' in select ? [] : roundedIds.map((id) => ({ id })),
    ),
  );
  const prisma = { task: { findMany } } as unknown as PrismaService;
  const service = new GradeProjectionService(
    prisma,
    {} as unknown as StudyPlanService,
  );
  return { service, findMany };
}

describe('GradeProjectionService roundInterimGrades', () => {
  beforeEach(() => {
    toFraction.mockClear();
    history.mockResolvedValue([graded('t1', 15.5), graded('t2', 12.5)]);
  });

  it('trains on the rounded grade for tasks whose program rounds', async () => {
    const { service } = build(['t1']);
    await service.project(USER);
    expect(toFraction.mock.calls.map(([grade]) => grade)).toEqual([16, 12.5]);
  });

  it('keeps the stored grade when no program rounds', async () => {
    const { service } = build([]);
    await service.project(USER);
    expect(toFraction.mock.calls.map(([grade]) => grade)).toEqual([15.5, 12.5]);
  });

  it('reads the flag scoped to the user and their own program', async () => {
    const { service, findMany } = build([]);
    await service.project(USER);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: USER,
        id: { in: ['t1', 't2'] },
        period: { program: { userId: USER, roundInterimGrades: true } },
      },
      select: { id: true },
    });
  });
});
