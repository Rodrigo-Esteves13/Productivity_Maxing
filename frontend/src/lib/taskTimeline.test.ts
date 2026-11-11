import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { buildTimeline, TIMELINE_WINDOW_DAYS } from './taskTimeline';

const NOW = new Date(2026, 10, 11, 12, 0, 0);

function task(over: Partial<Task>): Task {
  return {
    id: 't',
    title: 'T',
    date: new Date(2026, 10, 15).toISOString(),
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    availableFrom: null,
    ...over,
  } as Task;
}

describe('buildTimeline', () => {
  it('draws a bar from today to the deadline', () => {
    const { rows } = buildTimeline([task({})], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].leftPct).toBe(0);
    expect(rows[0].widthPct).toBeCloseTo((5 / TIMELINE_WINDOW_DAYS) * 100, 5);
    expect(rows[0].overdue).toBe(false);
  });

  it('skips completed tasks and unfirm dates', () => {
    const { rows } = buildTimeline(
      [task({ id: 'a', progressStatus: 'COMPLETED' }), task({ id: 'b', dateCertainty: 'UNKNOWN' })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('keeps overdue tasks as a short bar at the start', () => {
    const { rows } = buildTimeline([task({ date: new Date(2026, 10, 1).toISOString() })], NOW);
    expect(rows[0].overdue).toBe(true);
    expect(rows[0].leftPct).toBe(0);
  });

  it('starts at availableFrom and clips deadlines past the window', () => {
    const { rows } = buildTimeline(
      [task({ availableFrom: new Date(2026, 10, 20).toISOString(), date: new Date(2027, 2, 1).toISOString() })],
      NOW,
    );
    expect(rows[0].leftPct).toBeCloseTo((9 / TIMELINE_WINDOW_DAYS) * 100, 5);
    expect(rows[0].clippedEnd).toBe(true);
  });

  it('drops tasks that only open after the window', () => {
    const { rows } = buildTimeline(
      [task({ availableFrom: new Date(2027, 2, 1).toISOString(), date: new Date(2027, 3, 1).toISOString() })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('sorts by deadline', () => {
    const { rows } = buildTimeline(
      [task({ id: 'late', date: new Date(2026, 10, 30).toISOString() }), task({ id: 'soon' })],
      NOW,
    );
    expect(rows.map((r) => r.task.id)).toEqual(['soon', 'late']);
  });
});
