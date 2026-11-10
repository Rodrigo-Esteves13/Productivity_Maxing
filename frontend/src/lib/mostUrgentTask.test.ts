import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { mostUrgentTask } from './mostUrgentTask';

const NOW = new Date('2026-06-15T12:00:00Z');
const SAME_DATE = '2026-06-20T00:00:00.000Z';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    title: 'T',
    date: SAME_DATE,
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    isBlocked: false,
    availableFrom: null,
    priorityOrder: null,
    weightPercentage: null,
    ...overrides,
  } as Task;
}

describe('mostUrgentTask', () => {
  it('returns null without tasks', () => {
    expect(mostUrgentTask([], NOW)).toBeNull();
  });

  it('returns null when everything is completed', () => {
    expect(mostUrgentTask([makeTask({ progressStatus: 'COMPLETED' })], NOW)).toBeNull();
  });

  it('excludes blocked tasks', () => {
    const blocked = makeTask({ id: 'b', isBlocked: true, date: '2026-06-01T00:00:00.000Z' });
    const open = makeTask({ id: 'o', date: '2026-07-01T00:00:00.000Z' });
    expect(mostUrgentTask([blocked, open], NOW)?.id).toBe('o');
    expect(mostUrgentTask([blocked], NOW)).toBeNull();
  });

  it('puts overdue before upcoming', () => {
    const upcoming = makeTask({ id: 'u', date: '2026-06-16T00:00:00.000Z' });
    const overdue = makeTask({ id: 'o', date: '2026-06-10T00:00:00.000Z' });
    expect(mostUrgentTask([upcoming, overdue], NOW)?.id).toBe('o');
  });

  it('picks the nearest firm deadline', () => {
    const far = makeTask({ id: 'far', date: '2026-07-01T00:00:00.000Z' });
    const near = makeTask({ id: 'near', date: '2026-06-18T00:00:00.000Z' });
    expect(mostUrgentTask([far, near], NOW)?.id).toBe('near');
  });

  it('puts undated tasks last', () => {
    const undated = makeTask({ id: 'u', dateCertainty: 'UNKNOWN', date: '2026-06-01T00:00:00.000Z' });
    const dated = makeTask({ id: 'd', date: '2026-12-01T00:00:00.000Z' });
    expect(mostUrgentTask([undated, dated], NOW)?.id).toBe('d');
    expect(mostUrgentTask([undated], NOW)?.id).toBe('u');
  });

  it('breaks date ties by priority', () => {
    const low = makeTask({ id: 'low', priorityOrder: 3 });
    const high = makeTask({ id: 'high', priorityOrder: 1 });
    const none = makeTask({ id: 'none', priorityOrder: null });
    expect(mostUrgentTask([none, low, high], NOW)?.id).toBe('high');
  });

  it('breaks priority ties by weight, then title', () => {
    const light = makeTask({ id: 'light', weightPercentage: 10 });
    const heavy = makeTask({ id: 'heavy', weightPercentage: 40 });
    expect(mostUrgentTask([light, heavy], NOW)?.id).toBe('heavy');

    const b = makeTask({ id: 'b', title: 'B' });
    const a = makeTask({ id: 'a', title: 'A' });
    expect(mostUrgentTask([b, a], NOW)?.id).toBe('a');
  });
});
