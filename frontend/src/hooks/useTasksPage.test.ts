// F-24, F-26, F-37: comportamento do useTasksPage. Escrito antes de o dividir
// (useTaskCrud, useTaskReplan, ...); a API publica tem de ficar igual.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../test/hookHarness';
import type { Task } from '../types/models';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);

const api = vi.hoisted(() => ({
  getUserTasks: vi.fn(),
  getUserAreas: vi.fn(),
  getTaskMetadata: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  reorderTasks: vi.fn(),
  bulkRescheduleTasks: vi.fn(),
  bulkDeleteTasks: vi.fn(),
  bulkUpdateTaskStatus: vi.fn(),
  syncTaskToCalendar: vi.fn(),
  unsyncTaskFromCalendar: vi.fn(),
  addSubtasksBulk: vi.fn(),
}));
const feedback = vi.hoisted(() => ({ notify: vi.fn(), confirm: vi.fn() }));
const router = vi.hoisted(() => ({ params: new URLSearchParams(), setParams: vi.fn() }));
const academic = vi.hoisted(() => ({
  value: {
    activePeriod: { id: 'p1' } as { id: string } | null,
    isViewingAllPeriods: false,
    isViewingAllPrograms: false,
    isLoading: false,
  },
}));

vi.mock('../api/tasksService', () => api);
vi.mock('../api/areasService', () => api);
vi.mock('../api/metadataService', () => api);
vi.mock('../api/calendarService', () => api);
vi.mock('../api/subtasksService', () => api);
vi.mock('../context/useAcademic', () => ({ useAcademic: () => academic.value }));
vi.mock('../context/useFeedback', () => ({ useFeedback: () => feedback }));
vi.mock('../i18n/translate', () => ({ translateNow: (key: string) => key }));
vi.mock('../i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [router.params, router.setParams] }));
vi.mock('./useUndoableDelete', () => ({ useUndoableDelete: () => vi.fn() }));
vi.mock('../lib/restoreTask', () => ({ restoreTask: vi.fn() }));
vi.mock('../lib/onTimeQuestion', () => ({ askIfFinishedOnTime: vi.fn() }));
vi.mock('../lib/completionFeedback', () => ({ celebrateCompletion: vi.fn() }));

import { useTasksPage } from './useTasksPage';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    areaId: 'a1',
    date: '2026-11-01T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    postponedCount: 0,
    dateCertainty: 'EXACT',
    submissionDate: null,
    googleCalendarEventId: null,
    isPinned: false,
    ...extra,
  } as Task;
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

async function mount() {
  const hook = renderHook(() => useTasksPage());
  await settle();
  return hook;
}

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  feedback.notify.mockReset();
  feedback.confirm.mockReset();
  router.params = new URLSearchParams();
  router.setParams.mockReset();
  academic.value = {
    activePeriod: { id: 'p1' },
    isViewingAllPeriods: false,
    isViewingAllPrograms: false,
    isLoading: false,
  };
  api.getUserAreas.mockResolvedValue([{ id: 'a1' }]);
  api.getTaskMetadata.mockResolvedValue({
    taskTypes: [],
    academicTaskTypes: [],
    difficulties: ['EASY'],
    progressStatuses: ['NOT_STARTED'],
  });
  api.getUserTasks.mockResolvedValue([task('t1'), task('t2')]);
});

describe('useTasksPage: loading', () => {
  it('loads catalog and tasks of the active period', async () => {
    const hook = await mount();
    expect(hook.current.isLoading).toBe(false);
    expect(ids(hook.current.tasks)).toEqual(['t1', 't2']);
    expect(hook.current.difficulties).toEqual(['EASY']);
    expect(hook.current.priorities).toEqual([]);
    expect(api.getUserTasks.mock.calls[0][0]).toBe('p1');
  });

  it('waits for the academic context before asking for tasks', async () => {
    academic.value = { ...academic.value, isLoading: true };
    const hook = await mount();
    expect(api.getUserTasks).not.toHaveBeenCalled();
    expect(api.getUserAreas).toHaveBeenCalledTimes(1);
    expect(hook.current.isLoading).toBe(true);
  });

  it('shows an error and recovers with reload', async () => {
    api.getUserTasks.mockRejectedValueOnce(new Error('x'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const hook = await mount();
    expect(hook.current.error).toBe('hook.couldNotLoadTheData');
    expect(hook.current.isLoading).toBe(false);
    hook.current.reload();
    await settle();
    expect(hook.current.error).toBeNull();
    expect(ids(hook.current.tasks)).toEqual(['t1', 't2']);
    expect(api.getUserAreas).toHaveBeenCalledTimes(2);
  });
});

describe('useTasksPage: writes', () => {
  it('creates a task in date order and closes the form', async () => {
    api.createTask.mockResolvedValue(task('t0', { date: '2026-10-01T00:00:00.000Z' }));
    const hook = await mount();
    hook.current.openCreateModal();
    await hook.current.handleCreateTask({ title: 't0' } as never);
    expect(ids(hook.current.tasks)).toEqual(['t0', 't1', 't2']);
    expect(hook.current.isCreateModalOpen).toBe(false);
    expect(api.createTask).toHaveBeenCalledWith({ title: 't0' });
  });

  it('updates the selected task and syncs the calendar when asked', async () => {
    api.updateTask.mockResolvedValue(task('t1', { title: 'new' }));
    api.syncTaskToCalendar.mockResolvedValue({ googleCalendarEventId: 'ev' });
    const hook = await mount();
    hook.current.handleSelectTask(hook.current.tasks[0]);
    await hook.current.handleUpdateTask({ title: 'new', syncToCalendar: true } as never);
    expect(hook.current.selectedTask?.googleCalendarEventId).toBe('ev');
    expect(hook.current.tasks[0].title).toBe('new');
    expect(hook.current.isEditing).toBe(false);
  });

  it('deletes after confirmation', async () => {
    feedback.confirm.mockResolvedValue(true);
    api.deleteTask.mockResolvedValue(undefined);
    const hook = await mount();
    hook.current.handleSelectTask(hook.current.tasks[0]);
    await hook.current.handleDeleteTask();
    expect(ids(hook.current.tasks)).toEqual(['t2']);
    expect(hook.current.selectedTask).toBeNull();
  });

  it('reverts a failed status change', async () => {
    api.updateTask.mockRejectedValue(new Error('x'));
    const hook = await mount();
    await hook.current.changeTaskStatus(hook.current.tasks[0], 'IN_PROGRESS');
    expect(hook.current.tasks[0].progressStatus).toBe('NOT_STARTED');
    expect(feedback.notify).toHaveBeenCalledWith('board.moveFailed', 'error');
  });

  it('reorders optimistically and reverts on failure', async () => {
    api.reorderTasks.mockRejectedValue(new Error('x'));
    const hook = await mount();
    const pending = hook.current.reorderTasksInState(['t2', 't1']);
    expect(ids(hook.current.tasks)).toEqual(['t2', 't1']);
    await pending;
    expect(ids(hook.current.tasks)).toEqual(['t1', 't2']);
  });

  it('opens the task from ?open=', async () => {
    router.params = new URLSearchParams('open=t2');
    const hook = await mount();
    expect(hook.current.selectedTask?.id).toBe('t2');
  });
});

describe('useTasksPage: changing period (F-25)', () => {
  it('keeps the old list, flagged as stale, until the new one arrives', async () => {
    const hook = await mount();
    let resolve!: (tasks: Task[]) => void;
    api.getUserTasks.mockReturnValueOnce(new Promise<Task[]>((res) => (resolve = res)));
    academic.value = { ...academic.value, activePeriod: { id: 'p2' } };
    hook.rerender();
    expect(hook.current.isStale).toBe(true);
    expect(hook.current.isLoading).toBe(false);
    expect(ids(hook.current.tasks)).toEqual(['t1', 't2']);
    resolve([task('n1')]);
    await settle();
    expect(hook.current.isStale).toBe(false);
    expect(hook.current.dataPeriod).toBe('p2');
    expect(ids(hook.current.tasks)).toEqual(['n1']);
  });

  it('drops the old list when the new period fails to load', async () => {
    const hook = await mount();
    api.getUserTasks.mockRejectedValueOnce(new Error('x'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    academic.value = { ...academic.value, activePeriod: { id: 'p2' } };
    hook.rerender();
    await settle();
    expect(hook.current.tasks).toEqual([]);
    expect(hook.current.isStale).toBe(false);
    expect(hook.current.error).toBe('hook.couldNotLoadTheData');
  });

  it('ignores a late answer of the previous period', async () => {
    const hook = await mount();
    let resolveOld!: (tasks: Task[]) => void;
    api.getUserTasks
      .mockReturnValueOnce(new Promise<Task[]>((res) => (resolveOld = res)))
      .mockResolvedValueOnce([task('n3')]);
    academic.value = { ...academic.value, activePeriod: { id: 'p2' } };
    hook.rerender();
    academic.value = { ...academic.value, activePeriod: { id: 'p3' } };
    hook.rerender();
    await settle();
    resolveOld([task('old')]);
    await settle();
    expect(ids(hook.current.tasks)).toEqual(['n3']);
  });
});

describe('useTasksPage: replan (F-24)', () => {
  const moves = [
    { id: 't1', date: '2026-11-20' },
    { id: 't2', date: '2026-11-21' },
  ];

  it('applies the moves locally without asking for the list again', async () => {
    api.bulkRescheduleTasks.mockResolvedValue({ count: 1 });
    const hook = await mount();
    await expect(hook.current.replanTasks(moves)).resolves.toBe(true);
    expect(hook.current.tasks.map((t) => t.date)).toEqual([
      '2026-11-20T00:00:00.000Z',
      '2026-11-21T00:00:00.000Z',
    ]);
    expect(api.getUserTasks).toHaveBeenCalledTimes(1);
  });

  it('asks for the list again after a partial failure', async () => {
    api.bulkRescheduleTasks.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('x'));
    const hook = await mount();
    api.getUserTasks.mockResolvedValue([task('server')]);
    await expect(hook.current.replanTasks(moves)).resolves.toBe(false);
    await settle();
    expect(ids(hook.current.tasks)).toEqual(['server']);
    expect(hook.current.error).toBe('replan.error');
  });

  it('asks for the list again when the server moved fewer tasks', async () => {
    api.bulkRescheduleTasks.mockResolvedValue({ count: 0 });
    const hook = await mount();
    await expect(hook.current.replanTasks(moves)).resolves.toBe(true);
    await settle();
    expect(api.getUserTasks).toHaveBeenCalledTimes(2);
  });
});
