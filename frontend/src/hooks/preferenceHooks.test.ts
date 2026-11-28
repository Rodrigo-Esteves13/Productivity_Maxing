// F-30: chaves e formatos gravados pelos hooks de preferencia. Escritos antes
// da migracao para usePersistedState e a correr iguais depois dela.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserStubs, renderHook } from '../test/hookHarness';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);

import { useAbsenceLimitPref } from './useAbsenceLimitPref';
import { useAmbientSoundPref } from './useAmbientSoundPref';
import { useAreaListPrefs } from './useAreaListPrefs';
import { useAreaOrder } from './useAreaOrder';
import { useDailyDigestPref } from './useDailyDigestPref';
import { useDashboardWidgetOrder } from './useDashboardWidgetOrder';
import { useDashboardWidgetPrefs } from './useDashboardWidgetPrefs';
import { useEctsHoursPref } from './useEctsHoursPref';
import { useExamMode } from './useExamMode';
import { useGreetingPrefs } from './useGreetingPrefs';
import { useNoLeisureGoalPref } from './useNoLeisureGoalPref';
import { useNotebookAutosavePref } from './useNotebookAutosavePref';
import { usePaletteShortcutsPref } from './usePaletteShortcutsPref';
import { usePlanModePref } from './usePlanMode';
import { useSavedFilterViews } from './useSavedFilterViews';
import { useScheduleView } from './useScheduleView';
import { useShowArchivedTasks } from './useShowArchivedTasks';
import { useSingleTaskMode } from './useSingleTaskMode';
import { readStreakRestMode, useStreakRestPref } from './useStreakRestPref';
import { useTableDensity } from './useTableDensity';
import { useTaskSortMode } from './useTaskSortMode';
import { useTasksTableColumnOrder } from './useTasksTableColumnOrder';
import { useTasksView } from './useTasksView';
import { useTaskTemplates } from './useTaskTemplates';
import { useKeepScreenOnPref } from './useWakeLock';
import { DEFAULT_COLUMN_ORDER } from '../lib/tasksTableColumns';

let browser: ReturnType<typeof createBrowserStubs>;

beforeEach(() => {
  browser = createBrowserStubs();
  vi.stubGlobal('localStorage', browser.storage);
  vi.stubGlobal('window', browser.window);
});

interface Case {
  name: string;
  key: string;
  use: () => unknown;
  read: (value: never) => unknown;
  initial: unknown;
  change: (value: never) => void;
  stored: string;
  changed: unknown;
}

function make<T>(spec: {
  name: string;
  key: string;
  use: () => T;
  read: (value: T) => unknown;
  initial: unknown;
  change: (value: T) => void;
  stored: string;
  changed: unknown;
}): Case {
  return spec as unknown as Case;
}

const CASES: Case[] = [
  make({ name: 'examMode', key: 'pm-exam-mode', use: useExamMode, read: (v) => v.isExamMode, initial: false, change: (v) => v.setIsExamMode(true), stored: 'true', changed: true }),
  make({ name: 'singleTask', key: 'pm-single-task-mode', use: useSingleTaskMode, read: (v) => v.isSingleTaskMode, initial: false, change: (v) => v.setIsSingleTaskMode(true), stored: 'true', changed: true }),
  make({ name: 'showArchived', key: 'pm-show-archived-tasks', use: useShowArchivedTasks, read: (v) => v.showArchived, initial: false, change: (v) => v.toggleShowArchived(), stored: 'true', changed: true }),
  make({ name: 'planMode', key: 'pm-plan-mode', use: usePlanModePref, read: (v) => v.isPlanMode, initial: false, change: (v) => v.setIsPlanMode(true), stored: 'true', changed: true }),
  make({ name: 'density', key: 'dashboard-table-density', use: useTableDensity, read: (v) => v.density, initial: 'comfortable', change: (v) => v.toggleDensity(), stored: 'compact', changed: 'compact' }),
  make({ name: 'tasksView', key: 'pm-tasks-view', use: useTasksView, read: (v) => v.view, initial: 'grid', change: (v) => v.setView('board'), stored: 'board', changed: 'board' }),
  make({ name: 'scheduleView', key: 'pm-schedule-view', use: useScheduleView, read: (v) => v.view, initial: 'week', change: (v) => v.setView('month'), stored: 'month', changed: 'month' }),
  make({ name: 'noLeisure', key: 'no-leisure-days-goal', use: useNoLeisureGoalPref, read: (v) => v.goal, initial: expect.any(Number), change: (v) => v.setGoal(3), stored: '3', changed: 3 }),
  make({ name: 'absenceLimit', key: 'attendance-absence-limit-pct', use: useAbsenceLimitPref, read: (v) => v.limitPct, initial: expect.any(Number), change: (v) => v.setLimit(40), stored: '40', changed: 40 }),
  make({ name: 'ectsHours', key: 'ects-hours-per-credit', use: useEctsHoursPref, read: (v) => v.hoursPerCredit, initial: expect.any(Number), change: (v) => v.setHours(27), stored: '27', changed: 27 }),
  make({ name: 'dailyDigest', key: 'pm-daily-digest-enabled', use: useDailyDigestPref, read: (v) => v.enabled, initial: true, change: (v) => v.setEnabled(false), stored: 'false', changed: false }),
  make({ name: 'autosave', key: 'pm-notebook-autosave', use: useNotebookAutosavePref, read: (v) => v.autosaveEnabled, initial: true, change: (v) => v.setAutosaveEnabled(false), stored: 'false', changed: false }),
  make({ name: 'keepScreenOn', key: 'pm-focus-keep-screen-on', use: useKeepScreenOnPref, read: (v) => v.keepScreenOn, initial: true, change: (v) => v.setKeepScreenOn(false), stored: 'false', changed: false }),
  make({ name: 'paletteShortcuts', key: 'palette-shortcuts-enabled', use: usePaletteShortcutsPref, read: (v) => v.enabled, initial: true, change: (v) => v.setEnabled(false), stored: 'false', changed: false }),
  make({ name: 'streakRest', key: 'streak-rest-mode', use: useStreakRestPref, read: (v) => v.mode, initial: 'none', change: (v) => v.setMode('weekends'), stored: 'weekends', changed: 'weekends' }),
  make({ name: 'sortMode', key: 'pm-tasks-sort-mode', use: useTaskSortMode, read: (v) => v.sortMode, initial: 'manual', change: (v) => v.setSortMode('date'), stored: 'date', changed: 'date' }),
  make({ name: 'ambient', key: 'pm-focus-ambient', use: useAmbientSoundPref, read: (v) => v.pref, initial: { kind: 'brown', volume: 0.3 }, change: (v) => v.setPref({ kind: 'brown', volume: 0.5 }), stored: '{"kind":"brown","volume":0.5}', changed: { kind: 'brown', volume: 0.5 } }),
  make({ name: 'greeting', key: 'greeting-prefs:u1', use: () => useGreetingPrefs('u1'), read: (v) => v.showMotivation, initial: true, change: (v) => v.setShowMotivation(false), stored: '{"customGreeting":"","showMotivation":false}', changed: false }),
  make({ name: 'areaList', key: 'pm-area-list-prefs', use: useAreaListPrefs, read: (v) => v.sort, initial: expect.any(String), change: (v) => v.setSort('name'), stored: expect.stringContaining('"sort":"name"') as unknown as string, changed: 'name' }),
  make({ name: 'areaOrder', key: 'pm-area-order', use: useAreaOrder, read: (v) => v.isCustom, initial: false, change: (v) => v.moveArea(['a', 'b'], 'b', 'a'), stored: '["b","a"]', changed: true }),
];

describe.each(CASES)('preference $name', ({ key, use, read, initial, change, stored, changed }) => {
  const value = (hook: { current: unknown }) => read(hook.current as never);

  it('starts on the default and stores the same format', () => {
    const hook = renderHook(use);
    expect(value(hook)).toEqual(initial);
    change(hook.current as never);
    expect(value(hook)).toEqual(changed);
    expect(browser.data.get(key)).toEqual(stored);
  });

  it('reads what was already stored', () => {
    const first = renderHook(use);
    change(first.current as never);
    first.unmount();
    expect(value(renderHook(use))).toEqual(changed);
  });

  it('falls back to the default on unreadable storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(value(renderHook(use))).toEqual(initial);
  });
});

describe('preference hooks with their own shapes', () => {
  it('keeps a change in memory when storage refuses the write', () => {
    vi.stubGlobal('localStorage', {
      ...browser.storage,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const hook = renderHook(useTasksView);
    hook.current.setView('matrix');
    expect(hook.current.view).toBe('matrix');
    // Repor para nao deixar valor em memoria para outros testes.
    vi.stubGlobal('localStorage', browser.storage);
    hook.current.setView('grid');
    expect(browser.data.get('pm-tasks-view')).toBe('grid');
  });

  it('task sort direction uses its own key', () => {
    const hook = renderHook(useTaskSortMode);
    const before = hook.current.direction;
    hook.current.toggleDirection();
    expect(hook.current.direction).not.toBe(before);
    expect(browser.data.get('pm-tasks-sort-direction')).toBe(hook.current.direction);
  });

  it('removes area keys when back on the default', () => {
    const order = renderHook(useAreaOrder);
    order.current.moveArea(['a', 'b'], 'b', 'a');
    order.current.resetOrder();
    expect(browser.data.has('pm-area-order')).toBe(false);
    const list = renderHook(useAreaListPrefs);
    list.current.setSort('name');
    list.current.resetPrefs();
    expect(browser.data.has('pm-area-list-prefs')).toBe(false);
  });

  it('greeting prefs follow the account', () => {
    let userId = 'u1';
    const hook = renderHook(() => useGreetingPrefs(userId));
    hook.current.setCustomGreeting('Ola');
    userId = 'u2';
    hook.rerender();
    expect(hook.current.customGreeting).toBe('');
    userId = 'u1';
    hook.rerender();
    expect(hook.current.customGreeting).toBe('Ola');
    expect(browser.data.get('greeting-prefs:u1')).toBe('{"customGreeting":"Ola","showMotivation":true}');
  });

  it('streak rest mode is readable outside React', () => {
    const hook = renderHook(useStreakRestPref);
    hook.current.setMode('weekends');
    expect(readStreakRestMode()).toBe('weekends');
    hook.current.resetMode();
    expect(readStreakRestMode()).toBe(hook.current.mode);
  });

  it('widget visibility and order are stored as JSON', () => {
    const prefs = renderHook(useDashboardWidgetPrefs);
    prefs.current.toggle('today');
    expect(JSON.parse(browser.data.get('dashboard-widget-prefs')!).today).toBe(false);
    const order = renderHook(useDashboardWidgetOrder);
    order.current.moveDown('today');
    expect(JSON.parse(browser.data.get('dashboard-widget-order')!)[1]).toBe('today');
    order.current.reset();
    expect(order.current.isDefault).toBe(true);
  });

  it('table columns, saved views and templates are stored as JSON', () => {
    const columns = renderHook(useTasksTableColumnOrder);
    const [first, second] = DEFAULT_COLUMN_ORDER;
    columns.current.reorderColumns(second, first);
    expect(JSON.parse(browser.data.get('pm-tasks-table-column-order')!)[0]).toBe(second);

    const views = renderHook(useSavedFilterViews);
    views.current.saveView('A', {} as never);
    views.current.saveView('B', {} as never);
    expect(JSON.parse(browser.data.get('dashboard-saved-filter-views')!)).toHaveLength(2);
    views.current.deleteView(views.current.views[0].id);
    expect(views.current.views.map((v) => v.name)).toEqual(['B']);

    const templates = renderHook(useTaskTemplates);
    expect(templates.current.saveTemplate({ name: ' T ' } as never)).toBe(true);
    expect(JSON.parse(browser.data.get('pm-task-templates')!)[0].name).toBe('T');
    templates.current.deleteTemplate(templates.current.templates[0].id);
    expect(browser.data.get('pm-task-templates')).toBe('[]');
  });
});

// Novo com usePersistedState: sincronizacao entre instancias e entre tabs.
describe('preference sync', () => {
  it('every instance sees a change', () => {
    const a = renderHook(useTableDensity);
    const b = renderHook(useTableDensity);
    a.current.toggleDensity();
    expect(b.current.density).toBe('compact');
    b.current.toggleDensity();
    expect(a.current.density).toBe('comfortable');
  });

  it('follows writes and clears from another tab', () => {
    const hook = renderHook(useTasksView);
    browser.writeFromOtherTab('pm-tasks-view', 'timeline');
    expect(hook.current.view).toBe('timeline');
    browser.writeFromOtherTab('pm-tasks-view', null);
    expect(hook.current.view).toBe('grid');
  });

  it('stops listening after unmount and does not write on mount', () => {
    const remove = vi.spyOn(browser.window, 'removeEventListener');
    const hook = renderHook(useExamMode);
    expect(browser.data.size).toBe(0);
    hook.unmount();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});
