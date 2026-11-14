import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { overdueTasks, planReplan } from './replanOverdue';

// Meio do dia local, para o dia local de hoje nao depender do fuso.
const NOW = new Date(2026, 10, 13, 12, 0, 0);
const iso = (day: number) => new Date(Date.UTC(2026, 10, day)).toISOString();

function task(id: string, day: number, over: Partial<Task> = {}): Task {
  return {
    id,
    date: iso(day),
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    isBlocked: false,
    availableFrom: null,
    ...over,
  } as Task;
}

describe('overdueTasks', () => {
  it('keeps only open, firm, unlocked tasks before today, oldest first', () => {
    const tasks = [
      task('late2', 11),
      task('late1', 9),
      task('done', 8, { progressStatus: 'COMPLETED' }),
      task('guess', 8, { dateCertainty: 'UNKNOWN' }),
      task('blocked', 8, { isBlocked: true }),
      task('today', 13),
      task('future', 20),
    ];
    expect(overdueTasks(tasks, NOW).map((t) => t.id)).toEqual(['late1', 'late2']);
  });
});

describe('planReplan', () => {
  it('returns nothing when no task is overdue', () => {
    expect(planReplan([task('a', 14)], NOW)).toEqual([]);
  });

  it('spreads overdue tasks over the lightest days instead of piling them', () => {
    const tasks = [
      task('o1', 9),
      task('o2', 10),
      task('o3', 11),
      task('busy1', 13),
      task('busy2', 13),
    ];
    const plan = planReplan(tasks, NOW);
    expect(plan.map((m) => m.date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
  });

  it('only moves into the next seven days', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`o${i}`, 1 + i));
    const dates = new Set(planReplan(tasks, NOW).map((m) => m.date));
    expect([...dates].every((d) => d >= '2026-11-13' && d <= '2026-11-19')).toBe(true);
  });
});
