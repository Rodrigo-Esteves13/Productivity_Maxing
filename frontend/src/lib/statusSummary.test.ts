import { describe, expect, it } from 'vitest';
import type { Area, Task } from '../types/models';
import {
  computeStatusSummaryFacts,
  pickStatusSummaryClauses,
  STATUS_SUMMARY_DEADLINE_WINDOW_DAYS,
  STATUS_SUMMARY_MAX_CLAUSES,
} from './statusSummary';

const NOW = new Date('2026-03-10T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_DATE = '2020-01-01T00:00:00Z';

const area = (id: string, name: string): Area => ({ id, name }) as Area;
const task = (over: Partial<Task>): Task =>
  ({
    id: 't',
    areaId: 'a1',
    title: 'Task',
    date: new Date(NOW.getTime() + DAY_MS).toISOString(),
    dateCertainty: 'EXACT',
    progressStatus: 'PENDING',
    targetGrade: null,
    realGrade: null,
    weightPercentage: null,
    ...over,
  }) as Task;

describe('computeStatusSummaryFacts', () => {
  it('returns empty facts without data', () => {
    const facts = computeStatusSummaryFacts([], [], NOW);
    expect(facts).toEqual({ bestArea: null, worstArea: null, overdueCount: 0, nextDeadline: null });
    expect(pickStatusSummaryClauses(facts)).toEqual([]);
  });

  it('picks best and worst area by gap to target', () => {
    const areas = [area('a1', 'Math'), area('a2', 'Art')];
    const tasks = [
      task({ areaId: 'a1', targetGrade: 14, realGrade: 17, date: PAST_DATE, progressStatus: 'COMPLETED' }),
      task({ areaId: 'a2', targetGrade: 15, realGrade: 11, date: PAST_DATE, progressStatus: 'COMPLETED' }),
    ];
    const facts = computeStatusSummaryFacts(tasks, areas, NOW);
    expect(facts.bestArea?.name).toBe('Math');
    expect(facts.worstArea?.name).toBe('Art');
  });

  it('counts overdue and finds nearest deadline in window', () => {
    const tasks = [
      task({ id: 'o', date: new Date(NOW.getTime() - 3 * DAY_MS).toISOString() }),
      task({ id: 'far', title: 'Far', date: new Date(NOW.getTime() + 3 * DAY_MS).toISOString() }),
      task({ id: 'near', title: 'Near', date: new Date(NOW.getTime() + DAY_MS).toISOString() }),
      task({
        id: 'out',
        title: 'Out',
        date: new Date(NOW.getTime() + (STATUS_SUMMARY_DEADLINE_WINDOW_DAYS + 3) * DAY_MS).toISOString(),
      }),
    ];
    const facts = computeStatusSummaryFacts(tasks, [], NOW);
    expect(facts.overdueCount).toBe(1);
    expect(facts.nextDeadline).toEqual({ title: 'Near', daysLeft: 1 });
  });

  it('ignores completed and unfirm tasks for deadlines', () => {
    const tasks = [task({ progressStatus: 'COMPLETED' }), task({ dateCertainty: 'UNKNOWN' })];
    expect(computeStatusSummaryFacts(tasks, [], NOW).nextDeadline).toBeNull();
  });
});

describe('pickStatusSummaryClauses', () => {
  it('caps clauses and drops lowest priority first', () => {
    const clauses = pickStatusSummaryClauses({
      bestArea: { name: 'A', average: 1, target: 1 },
      worstArea: { name: 'B', average: 1, target: 2 },
      overdueCount: 2,
      nextDeadline: { title: 'T', daysLeft: 2 },
    });
    expect(clauses).toHaveLength(STATUS_SUMMARY_MAX_CLAUSES);
    expect(clauses).toEqual(['behind', 'overdue', 'next']);
  });
});
