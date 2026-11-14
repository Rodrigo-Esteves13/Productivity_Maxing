import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { computeTypeBalance, MIN_BALANCE_TASKS } from './typeBalance';

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const day = (offset: number) => new Date(2026, 10, 13 + offset).toISOString();

function task(type: string, date: string, completedAt: string | null = null): Task {
  return { type, date, completedAt } as Task;
}

describe('computeTypeBalance', () => {
  it('needs enough tasks in the window', () => {
    const few = Array.from({ length: MIN_BALANCE_TASKS - 1 }, () => task('ACADEMICO', day(-1)));
    expect(computeTypeBalance(few, NOW)).toBeNull();
  });

  it('counts shares by type, biggest first', () => {
    const tasks = [
      ...Array.from({ length: 4 }, () => task('ACADEMICO', day(-2))),
      task('HABITO', day(1)),
      task('PROJETO', day(3)),
    ];
    const result = computeTypeBalance(tasks, NOW)!;
    expect(result.total).toBe(6);
    expect(result.shares.map((s) => [s.type, s.percent])).toEqual([
      ['ACADEMICO', 67],
      ['HABITO', 17],
      ['PROJETO', 17],
    ]);
  });

  it('ignores tasks outside the window and uses completedAt when present', () => {
    const tasks = [
      ...Array.from({ length: 5 }, () => task('ACADEMICO', day(-90), day(-1))),
      task('HABITO', day(-90)),
      task('HABITO', day(-1)),
    ];
    const result = computeTypeBalance(tasks, NOW)!;
    expect(result.total).toBe(6);
    expect(result.shares[0]).toMatchObject({ type: 'ACADEMICO', count: 5 });
  });
});
