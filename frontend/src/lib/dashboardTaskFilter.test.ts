import { describe, expect, it } from 'vitest';
import { EMPTY_DASHBOARD_FILTERS } from '../components/Dashboard/dashboardFilters.types';
import type { Task } from '../types/models';
import { emptyMessageKey, filterDashboardTasks } from './dashboardTaskFilter';

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    areaId: 'a1',
    date: '2999-01-01T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    difficulty: 'EASY',
    tags: [],
    ...extra,
  } as Task;
}

const SHOW_ALL = { showArchived: true, isExamMode: false };
const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('filterDashboardTasks', () => {
  const tasks = [task('1', { tags: ['x'] }), task('2', { areaId: 'a2', difficulty: 'HARD' as Task['difficulty'] })];

  it('keeps everything with empty filters', () => {
    expect(ids(filterDashboardTasks(tasks, EMPTY_DASHBOARD_FILTERS, SHOW_ALL))).toEqual(['1', '2']);
  });

  it('combines search, area and tag', () => {
    const by = (patch: object) =>
      ids(filterDashboardTasks(tasks, { ...EMPTY_DASHBOARD_FILTERS, ...patch }, SHOW_ALL));
    expect(by({ search: '  TASK 2 ' })).toEqual(['2']);
    expect(by({ areaId: 'a2' })).toEqual(['2']);
    expect(by({ tag: 'x' })).toEqual(['1']);
    expect(by({ tag: 'x', areaId: 'a2' })).toEqual([]);
  });
});

describe('emptyMessageKey', () => {
  it('explains why the table is empty', () => {
    expect(emptyMessageKey(0, true)).toBe('ui.youHaveNoAcademicTasks');
    expect(emptyMessageKey(3, true)).toBe('examMode.noExamsInTable');
    expect(emptyMessageKey(3, false)).toBe('ui.noTasksMatchTheCurrent');
  });
});
