import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { ALL_AREAS, filterTasksByAreaAndState, isTaskStateFilter, taskSearchFields } from './taskListFilter';

const NOW = new Date('2026-06-15T12:00:00Z');

function task(partial: Partial<Task>): Task {
  return {
    id: 'x',
    title: 'T',
    areaId: 'a1',
    date: '2026-06-20T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    ...partial,
  } as Task;
}

describe('filterTasksByAreaAndState', () => {
  const tasks = [
    task({ id: '1', areaId: 'a1' }),
    task({ id: '2', areaId: 'a2', progressStatus: 'COMPLETED' }),
    task({ id: '3', areaId: 'a1', date: '2026-06-01T00:00:00.000Z' }),
  ];

  it('all keeps everything', () => {
    expect(filterTasksByAreaAndState(tasks, ALL_AREAS, 'all', NOW)).toHaveLength(3);
  });
  it('filters by area', () => {
    expect(filterTasksByAreaAndState(tasks, 'a2', 'all', NOW).map((t) => t.id)).toEqual(['2']);
  });
  it('pending excludes completed', () => {
    expect(filterTasksByAreaAndState(tasks, ALL_AREAS, 'pending', NOW).map((t) => t.id)).toEqual(['1', '3']);
  });
  it('completed keeps completed', () => {
    expect(filterTasksByAreaAndState(tasks, ALL_AREAS, 'completed', NOW).map((t) => t.id)).toEqual(['2']);
  });
  it('overdue keeps open past tasks', () => {
    expect(filterTasksByAreaAndState(tasks, ALL_AREAS, 'overdue', NOW).map((t) => t.id)).toEqual(['3']);
  });
});

describe('helpers', () => {
  it('validates state filter', () => {
    expect(isTaskStateFilter('overdue')).toBe(true);
    expect(isTaskStateFilter('nope')).toBe(false);
  });
  it('search fields include title and area', () => {
    const fields = taskSearchFields(task({ title: 'Essay', area: { name: 'History' } as Task['area'] }));
    expect(fields).toContain('Essay');
    expect(fields).toContain('History');
  });
});
