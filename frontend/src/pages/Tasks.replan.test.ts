import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { renderHook } from '../test/hookHarness';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);
const page = vi.hoisted(() => ({ isStale: false }));
vi.mock('../hooks/useTasksPage', () => ({
  useTasksPage: () => ({
    tasks: [{ id: 't1', date: '2000-01-01T00:00:00.000Z', progressStatus: 'NOT_STARTED' }],
    areas: [],
    progressStatuses: [],
    isLoading: false,
    isStale: page.isStale,
    error: null,
    selectedTask: null,
    isEditing: false,
    isCreateModalOpen: false,
  }),
}));
vi.mock('../i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()], Link: () => null }));
vi.mock('../hooks/useDocumentTitle', () => ({ default: () => undefined }));
vi.mock('../hooks/useTaskShortcuts', () => ({ useTaskShortcuts: () => undefined }));
vi.mock('../hooks/useDirtyForm', () => ({ useDirtyForm: () => ({ isDirty: false, markDirty: vi.fn() }) }));
vi.mock('../hooks/useTasksView', () => ({
  TASKS_VIEWS: ['grid'],
  isTasksView: () => false,
  useTasksView: () => ({ view: 'grid', setView: vi.fn() }),
}));
vi.mock('../hooks/useShowArchivedTasks', () => ({
  useShowArchivedTasks: () => ({ showArchived: false, toggleShowArchived: vi.fn() }),
}));
vi.mock('../hooks/useTaskSortMode', () => ({
  useTaskSortMode: () => ({ sortMode: 'manual', setSortMode: vi.fn(), direction: 'asc', toggleDirection: vi.fn() }),
}));
vi.mock('../hooks/useListSearch', () => ({
  useListSearch: (items: unknown[]) => ({
    filtered: items,
    query: '',
    setQuery: vi.fn(),
    clear: vi.fn(),
    isFiltering: false,
  }),
}));

import Tasks from './Tasks';
import ReplanOverdueModal from '../components/Tasks/ReplanOverdueModal';

type Element = ReactElement<Record<string, unknown>>;

// Percorre os elementos, incluindo os passados em props (ex.: action do cabecalho).
function find(node: unknown, match: (element: Element) => boolean): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, match);
      if (found) return found;
    }
    return undefined;
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return undefined;
  const element = node as Element;
  if (match(element)) return element;
  return find(Object.values(element.props), match);
}

describe('Tasks page replan modal', () => {
  it('closes when the period changes and does not reopen by itself', () => {
    const hook = renderHook(() => Tasks() as ReactNode);
    const modal = () => find(hook.current, (element) => element.type === ReplanOverdueModal);
    const button = find(hook.current, (element) => element.props.children === 'replan.button');
    (button?.props.onClick as () => void)();
    expect(modal()).toBeDefined();

    page.isStale = true;
    hook.rerender();
    expect(modal()).toBeUndefined();

    page.isStale = false;
    hook.rerender();
    expect(modal()).toBeUndefined();
  });
});
