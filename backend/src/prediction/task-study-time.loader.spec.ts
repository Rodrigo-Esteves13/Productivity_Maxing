import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  resolveFocusedStudyMinutes,
  resolveStudyMinutes,
  sumFocusedSessionMinutes,
  sumSessionMinutes,
} from '../common/session-minutes.util';
import { MS_PER_MINUTE } from '../common/time.constants';
import {
  loadAggregatedTaskSessions,
  recentHistoryWhere,
} from './task-study-time.loader';

const SECONDS_PER_MINUTE = 60;
const START = Date.parse('2026-10-01T10:00:00.000Z');

const session = (
  offsetMin: number,
  minutes: number,
  focusRating: number | null,
) => ({
  startedAt: new Date(START + offsetMin * MS_PER_MINUTE),
  endedAt: new Date(START + (offsetMin + minutes) * MS_PER_MINUTE),
  focusRating,
});

function prismaWith(rows: unknown[]) {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return { prisma, queryRaw };
}

describe('loadAggregatedTaskSessions', () => {
  it('gives the same clock and focused minutes as the per-session sums', async () => {
    // Sessoes reais da task: duas com nota 1, uma com 5, uma sem nota.
    const real = [
      session(0, 25, 1),
      session(30, 20.5, 1),
      session(60, 50, 5),
      session(120, 33, null),
    ];
    // O que o GROUP BY taskId, focusRating devolveria para elas.
    const { prisma, queryRaw } = prismaWith([
      { taskId: 't1', focusRating: 1, seconds: 45.5 * SECONDS_PER_MINUTE },
      { taskId: 't1', focusRating: 5, seconds: 50 * SECONDS_PER_MINUTE },
      {
        taskId: 't1',
        focusRating: null,
        seconds: BigInt(33 * SECONDS_PER_MINUTE),
      },
    ]);

    const byTask = await loadAggregatedTaskSessions(prisma, 'u1', ['t1', 't2']);
    const aggregated = byTask.get('t1') ?? [];

    expect(sumSessionMinutes(aggregated)).toBe(sumSessionMinutes(real));
    expect(sumFocusedSessionMinutes(aggregated)).toBe(
      sumFocusedSessionMinutes(real),
    );
    // Sem sessoes (t2): cai no tempo recordado, como antes.
    expect(resolveStudyMinutes(byTask.get('t2') ?? [], 40)).toBe(40);
    expect(resolveFocusedStudyMinutes(byTask.get('t2') ?? [], 40)).toBe(40);

    const [query] = queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(query.values).toEqual(['u1', ['t1', 't2']]);
    expect(query.text).toContain('"endedAt" IS NOT NULL');
  });

  it('skips the query when there are no tasks', async () => {
    const { prisma, queryRaw } = prismaWith([]);
    const byTask = await loadAggregatedTaskSessions(prisma, 'u1', []);
    expect(byTask.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('recentHistoryWhere', () => {
  it('keeps tasks completed in the window, or undated-completion tasks dated in it', () => {
    const now = new Date('2026-11-22T00:00:00.000Z');
    const since = new Date('2025-11-22T00:00:00.000Z');
    expect(recentHistoryWhere(now)).toEqual({
      OR: [
        { completedAt: { gte: since } },
        { completedAt: null, date: { gte: since } },
      ],
    });
  });
});
