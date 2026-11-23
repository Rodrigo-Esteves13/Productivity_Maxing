import { WeeklyReviewService } from './weekly-review.service';
import { ACTIONABLE_DEADLINE_WHERE } from '../common/task-readiness.util';
import type { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-06-10T12:00:00.000Z');

interface Opts {
  completed?: unknown[];
  postponed?: unknown[];
  overdue?: number;
  sessions?: unknown[];
  upcoming?: unknown[];
}

function setup(opts: Opts = {}) {
  // Ordem de chamada de task.findMany: completed, postponed, upcoming.
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(opts.completed ?? [])
    .mockResolvedValueOnce(opts.postponed ?? [])
    .mockResolvedValueOnce(opts.upcoming ?? []);
  const prisma = {
    task: {
      findMany,
      count: jest.fn().mockResolvedValue(opts.overdue ?? 0),
    },
    studySession: {
      findMany: jest.fn().mockResolvedValue(opts.sessions ?? []),
    },
  };
  const service = new WeeklyReviewService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const session = (
  minutes: number,
  focus: number | null,
  areaName: string | null,
) => {
  const startedAt = new Date('2026-06-09T10:00:00Z');
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
    focusRating: focus,
    area: areaName ? { name: areaName } : null,
  };
};

describe('WeeklyReviewService.build', () => {
  it('scopes every query to the user', async () => {
    const { service, prisma } = setup();
    await service.build('u1', NOW);

    for (const call of prisma.task.findMany.mock.calls as [
      { where: { userId: string } },
    ][]) {
      expect(call[0].where.userId).toBe('u1');
    }
    const [countArg] = prisma.task.count.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(countArg.where.userId).toBe('u1');
    const [sessArg] = prisma.studySession.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(sessArg.where.userId).toBe('u1');
    expect(prisma.task.findMany).toHaveBeenCalledTimes(3);
  });

  it('empty week: zeros, nulls and the 7 day window around now', async () => {
    const { service } = setup();
    const review = await service.build('u1', NOW);
    expect(review).toEqual({
      from: '2026-06-03T12:00:00.000Z',
      to: '2026-06-10T12:00:00.000Z',
      completed: [],
      postponed: [],
      overdueCount: 0,
      studyMinutes: 0,
      studyByArea: [],
      focusAverage: null,
      upcoming: [],
    });
  });

  it('overdue count uses the actionable deadline rule and start of today', async () => {
    const { service, prisma } = setup({ overdue: 4 });
    const review = await service.build('u1', NOW);
    expect(review.overdueCount).toBe(4);
    const [arg] = prisma.task.count.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(arg.where).toMatchObject({
      progressStatus: { not: 'COMPLETED' },
      date: { lt: new Date('2026-06-10T00:00:00.000Z') },
      ...ACTIONABLE_DEADLINE_WHERE,
    });
  });

  it('maps tasks, falling back to null area names', async () => {
    const { service } = setup({
      completed: [
        {
          id: 'c1',
          title: 'Done',
          completedAt: new Date('2026-06-09T09:00:00Z'),
          area: { name: 'Math' },
        },
        {
          id: 'c2',
          title: 'Done 2',
          completedAt: new Date('2026-06-08T09:00:00Z'),
          area: null,
        },
      ],
      postponed: [{ id: 'p1', title: 'Later', postponedCount: 3, area: null }],
      upcoming: [
        {
          id: 'n1',
          title: 'Next',
          date: new Date('2026-06-12T00:00:00Z'),
          area: { name: 'Bio' },
        },
      ],
    });
    const review = await service.build('u1', NOW);
    expect(review.completed).toEqual([
      {
        id: 'c1',
        title: 'Done',
        areaName: 'Math',
        completedAt: '2026-06-09T09:00:00.000Z',
      },
      {
        id: 'c2',
        title: 'Done 2',
        areaName: null,
        completedAt: '2026-06-08T09:00:00.000Z',
      },
    ]);
    expect(review.postponed).toEqual([
      { id: 'p1', title: 'Later', areaName: null, postponedCount: 3 },
    ]);
    expect(review.upcoming[0]).toEqual({
      id: 'n1',
      title: 'Next',
      areaName: 'Bio',
      date: '2026-06-12T00:00:00.000Z',
    });
  });

  it('sums study minutes per area, sorted desc, with a No area bucket', async () => {
    const { service } = setup({
      sessions: [
        session(30, 4, 'Math'),
        session(60, 2, 'Bio'),
        session(15, null, null),
        session(30, 5, 'Math'),
      ],
    });
    const review = await service.build('u1', NOW);
    expect(review.studyMinutes).toBe(135);
    expect(review.studyByArea).toEqual([
      { areaName: 'Math', minutes: 60 },
      { areaName: 'Bio', minutes: 60 },
      { areaName: 'No area', minutes: 15 },
    ]);
  });

  it('focus average ignores unrated sessions', async () => {
    const { service } = setup({
      sessions: [
        session(30, 4, 'Math'),
        session(30, 5, 'Math'),
        session(30, null, 'Math'),
      ],
    });
    const review = await service.build('u1', NOW);
    expect(review.focusAverage).toBe(4.5);
  });

  it('caps a forgotten session at 12 hours', async () => {
    const { service } = setup({ sessions: [session(60 * 40, null, 'Math')] });
    const review = await service.build('u1', NOW);
    expect(review.studyMinutes).toBe(12 * 60);
  });

  it('a session ending before it started counts as 0 minutes', async () => {
    const s = session(30, null, 'Math');
    const { service } = setup({
      sessions: [{ ...s, endedAt: new Date(s.startedAt.getTime() - 60_000) }],
    });
    const review = await service.build('u1', NOW);
    expect(review.studyMinutes).toBe(0);
  });

  it('propagates a DB failure', async () => {
    const { service, prisma } = setup();
    prisma.task.count.mockRejectedValue(new Error('db down'));
    await expect(service.build('u1', NOW)).rejects.toThrow('db down');
  });
});
