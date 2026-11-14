import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { groupByQuadrant, quadrantOf } from './eisenhower';

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const iso = (day: number) => new Date(Date.UTC(2026, 10, day)).toISOString();

function task(id: string, day: number, over: Partial<Task> = {}): Task {
  return { id, date: iso(day), progressStatus: 'NOT_STARTED', dateCertainty: 'EXACT', isBlocked: false, ...over } as Task;
}

describe('quadrantOf', () => {
  it('splits by urgency and importance', () => {
    expect(quadrantOf(task('a', 14, { priority: 'HIGH' }), NOW)).toBe('doFirst');
    expect(quadrantOf(task('b', 30, { weightPercentage: 20 }), NOW)).toBe('schedule');
    expect(quadrantOf(task('c', 13), NOW)).toBe('quick');
    expect(quadrantOf(task('d', 30), NOW)).toBe('later');
  });
  it('treats overdue as urgent and guessed dates as not urgent', () => {
    expect(quadrantOf(task('e', 1), NOW)).toBe('quick');
    expect(quadrantOf(task('f', 14, { dateCertainty: 'UNKNOWN' }), NOW)).toBe('later');
  });
});

describe('groupByQuadrant', () => {
  it('skips completed and blocked tasks and sorts by date', () => {
    const groups = groupByQuadrant(
      [
        task('late', 20),
        task('soon', 13),
        task('done', 13, { progressStatus: 'COMPLETED' }),
        task('blocked', 13, { isBlocked: true }),
      ],
      NOW,
    );
    expect(groups.quick.map((t) => t.id)).toEqual(['soon']);
    expect(groups.later.map((t) => t.id)).toEqual(['late']);
    expect(Object.values(groups).flat()).toHaveLength(2);
  });
});
