import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../types/models';
import { getSwipeActions, getTaskPresentation } from './taskPresentation';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function task(extra: Partial<Task> = {}): Task {
  return {
    id: 't1',
    date: '2026-11-01T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    submissionDate: null,
    weightPercentage: 20,
    ...extra,
  } as Task;
}

describe('getTaskPresentation', () => {
  it('flags an open task in the past as overdue', () => {
    const view = getTaskPresentation(task(), 'en', NOW);
    expect(view).toMatchObject({ status: 'overdue', isOverdue: true, handIn: null, weight: '20%' });
    expect(view.due).not.toBe('');
  });

  it('never flags a completed task and shows N/A without weight', () => {
    const view = getTaskPresentation(task({ progressStatus: 'COMPLETED', weightPercentage: null }), 'en', NOW);
    expect(view).toMatchObject({ status: 'completed', isOverdue: false, weight: 'N/A' });
  });
});

describe('getSwipeActions', () => {
  it('offers complete and postpone only when they apply', () => {
    const onComplete = vi.fn();
    const onReschedule = vi.fn();
    const open = task();
    const actions = getSwipeActions(open, true, { onComplete, onReschedule });
    actions.onSwipeRight?.();
    actions.onSwipeLeft?.();
    expect(onComplete).toHaveBeenCalledWith(open);
    expect(onReschedule).toHaveBeenCalledWith(null, open);

    const done = getSwipeActions(task({ progressStatus: 'COMPLETED' }), false, { onComplete, onReschedule });
    expect(done).toEqual({ onSwipeRight: undefined, onSwipeLeft: undefined });
  });
});
