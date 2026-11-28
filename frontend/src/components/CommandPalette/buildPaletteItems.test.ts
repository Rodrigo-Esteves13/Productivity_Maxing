import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Area, NotebookSearchResult, Task, TurmaNoteSearchResult } from '../../types/models';
import type { RecentEntry } from '../../lib/paletteRecents';
import {
  buildPaletteItems,
  indexTasks,
  MAX_NOTEBOOK_RESULTS,
  MAX_TASK_RESULTS,
  MAX_TURMA_NOTE_RESULTS,
  type BuildPaletteItemsInput,
  type PaletteItem,
} from './buildPaletteItems';
import { NAV_COMMANDS, SHORTCUTS_COMMAND_ID } from './navCommands';

const task = (id: string, title: string, extra: Partial<Task> = {}) => ({ id, title, ...extra }) as Task;
const area = (id: string, name: string) => ({ id, name }) as Area;
const note = (id: string, title: string) => ({ id, title }) as NotebookSearchResult;
const turmaNote = (id: string, title: string) =>
  ({ id, title, turmaName: 'T1', turmaId: 'turma' }) as TurmaNoteSearchResult;

const build = (over: Partial<BuildPaletteItemsInput> & { tasks?: Task[] } = {}) => {
  const { tasks = [], ...rest } = over;
  return buildPaletteItems({
    query: '',
    taskIndex: indexTasks(tasks),
    tasksLoaded: true,
    notebookResults: [],
    turmaNoteResults: [],
    areas: null,
    lastUsedAreaId: null,
    isAdmin: false,
    recents: [],
    shortcutsEnabled: true,
    t: (key) => key,
    ...rest,
  });
};

const ofKind = <K extends PaletteItem['kind']>(items: PaletteItem[], kind: K) =>
  items.filter((i): i is Extract<PaletteItem, { kind: K }> => i.kind === kind);

const publicNavIds = NAV_COMMANDS.filter((c) => !c.adminOnly).map((c) => c.id);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-24T10:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('buildPaletteItems: navigation', () => {
  it('lists every non admin command in declaration order with an empty query', () => {
    const items = build({ tasks: [task('t1', 'Exam')], notebookResults: [note('n1', 'Note')] });
    expect(items.map((i) => i.id)).toEqual(publicNavIds);
  });

  it('includes admin commands only for admins', () => {
    expect(build({ isAdmin: true }).map((i) => i.id)).toEqual(NAV_COMMANDS.map((c) => c.id));
  });

  it('matches by translated label or by keyword', () => {
    expect(ofKind(build({ query: 'NAV.REVIEW' }), 'nav').map((i) => i.id)).toEqual(['nav-review']);
    expect(ofKind(build({ query: 'kanban' }), 'nav').map((i) => i.id)).toEqual(['nav-tasks-board']);
  });

  it('keeps command ids unique', () => {
    expect(new Set(NAV_COMMANDS.map((c) => c.id)).size).toBe(NAV_COMMANDS.length);
    expect(NAV_COMMANDS.find((c) => c.id === SHORTCUTS_COMMAND_ID)?.path).toBe('');
  });
});

describe('buildPaletteItems: order and limits', () => {
  it('orders nav, tasks, notebook, turma notes and quick add last', () => {
    const items = build({
      query: 'study',
      tasks: [task('t1', 'study plan')],
      notebookResults: [note('n1', 'Note')],
      turmaNoteResults: [turmaNote('tn1', 'Shared')],
    });
    const kinds = items.map((i) => i.kind).filter((k, i, all) => all[i - 1] !== k);
    expect(kinds).toEqual(['nav', 'task', 'notebook', 'turmaNote', 'quick-add']);
    expect(ofKind(items, 'turmaNote')[0].label).toBe('Shared (T1)');
  });

  it('caps notebook and turma note results', () => {
    const items = build({
      query: 'zzz',
      notebookResults: Array.from({ length: MAX_NOTEBOOK_RESULTS + 2 }, (_, i) => note(`n${i}`, 'N')),
      turmaNoteResults: Array.from({ length: MAX_TURMA_NOTE_RESULTS + 2 }, (_, i) => turmaNote(`x${i}`, 'N')),
    });
    expect(ofKind(items, 'notebook')).toHaveLength(MAX_NOTEBOOK_RESULTS);
    expect(ofKind(items, 'turmaNote')).toHaveLength(MAX_TURMA_NOTE_RESULTS);
  });
});

describe('buildPaletteItems: tasks', () => {
  it('puts title matches before notes and subtask matches, with a snippet', () => {
    const items = build({
      query: 'calculo',
      tasks: [
        task('body', 'A', { notes: 'rever cálculo hoje' }),
        task('sub', 'B', { subtasks: [{ title: 'Cálculo II' }] as Task['subtasks'] }),
        task('title', 'Cálculo'),
      ],
    });
    const matches = ofKind(items, 'task');
    expect(matches.map((i) => i.id)).toEqual(['title', 'body', 'sub']);
    expect(matches[0].detail).toBeUndefined();
    expect(matches[1].detail?.prefix).toBe('palette.inNotes');
    expect(matches[2].detail?.prefix).toBe('palette.inSubtask');
  });

  it('caps task results, title matches first', () => {
    const tasks = [
      task('body', 'A', { notes: 'zzz' }),
      ...Array.from({ length: MAX_TASK_RESULTS + 2 }, (_, i) => task(`t${i}`, `zzz ${i}`)),
    ];
    expect(ofKind(build({ query: 'zzz', tasks }), 'task').map((i) => i.id)).toEqual(
      Array.from({ length: MAX_TASK_RESULTS }, (_, i) => `t${i}`),
    );
  });
});

describe('buildPaletteItems: quick add', () => {
  const areas = [area('a1', 'Redes'), area('a2', 'Sistemas Operativos')];

  it('shows only the create row with the + prefix', () => {
    const items = build({ query: '+ kanban', areas, tasks: [task('t1', 'kanban')] });
    expect(items.map((i) => i.kind)).toEqual(['quick-add']);
    expect(ofKind(items, 'quick-add')[0].title.toLowerCase()).toBe('kanban');
  });

  it('shows nothing for a lone +', () => {
    expect(build({ query: '+' })).toEqual([]);
  });

  it('prefers the area written in the text, then the last used, then the first', () => {
    const areaOf = (query: string, lastUsedAreaId: string | null) =>
      ofKind(build({ query, areas, lastUsedAreaId }), 'quick-add')[0].area?.id;
    expect(areaOf('+ Exame Redes', 'a2')).toBe('a1');
    expect(areaOf('+ Exame', 'a2')).toBe('a2');
    expect(areaOf('+ Exame', 'gone')).toBe('a1');
  });

  it('has no area while areas are not loaded', () => {
    expect(ofKind(build({ query: '+ Exame' }), 'quick-add')[0].area).toBeNull();
  });
});

describe('buildPaletteItems: recents', () => {
  const recents: RecentEntry[] = [
    { kind: 'task', id: 't1', label: 'Old title' },
    { kind: 'nav', id: 'nav-review' },
    { kind: 'task', id: 'gone', label: 'Gone' },
    { kind: 'nav', id: 'nav-users' },
    { kind: 'notebook', id: 'n1', label: 'Note' },
    { kind: 'turmaNote', id: 'x', label: 'No parent' },
  ];
  const tasks = [task('t1', 'New title')];

  it('puts recents first, resolves labels and removes the duplicated nav row', () => {
    const items = build({ recents, tasks });
    expect(items.slice(0, 3).map((i) => [i.id, i.label])).toEqual([
      ['recent-task-t1', 'New title'],
      ['recent-nav-nav-review', 'nav.review'],
      ['recent-notebook-n1', 'Note'],
    ]);
    expect(ofKind(items, 'recent')).toHaveLength(3);
    expect(items.some((i) => i.id === 'nav-review')).toBe(false);
  });

  it('keeps stored task labels while tasks are not loaded', () => {
    const items = build({ recents, tasksLoaded: false });
    expect(ofKind(items, 'recent').map((i) => i.label)).toEqual(['Old title', 'nav.review', 'Gone', 'Note']);
  });

  it('hides recents with a query or with shortcuts off', () => {
    expect(ofKind(build({ recents, tasks, query: 'review' }), 'recent')).toEqual([]);
    expect(ofKind(build({ recents, tasks, shortcutsEnabled: false }), 'recent')).toEqual([]);
  });
});
