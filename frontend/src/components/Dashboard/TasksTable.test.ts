import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { createBrowserStubs, renderHook } from '../../test/hookHarness';
import type { Task } from '../../types/models';

vi.mock('react', async (importOriginal) =>
  (await import('../../test/hookHarness')).reactShim(await importOriginal()),
);
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  flushSync: (fn: () => void) => fn(),
}));
vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/useTasksTableColumnOrder', () => ({
  useTasksTableColumnOrder: () => ({ columnOrder: [], reorderColumns: vi.fn() }),
}));
vi.mock('./TaskTableRow', () => ({ default: () => null }));

import TasksTable from './TasksTable';
import TaskTableRow from './TaskTableRow';
import { TASKS_PAGE_SIZE } from '../../hooks/useRevealedTasks';

const tasks = Array.from({ length: TASKS_PAGE_SIZE * 2 + 10 }, (_, i) => ({ id: `t${i}` }) as Task);

function countRows(node: ReactNode): number {
  if (Array.isArray(node)) return node.reduce<number>((sum, child) => sum + countRows(child), 0);
  if (!node || typeof node !== 'object') return 0;
  const element = node as ReactElement<{ children?: ReactNode }>;
  return (element.type === TaskTableRow ? 1 : 0) + countRows(element.props.children);
}

afterEach(() => vi.unstubAllGlobals());

describe('TasksTable selection', () => {
  it('reveals every row once everything is selected, also after the order changes', () => {
    vi.stubGlobal('window', createBrowserStubs().window);
    let selectedIds = new Set<string>();
    let resetKey = 'a';
    const hook = renderHook(() => TasksTable({ tasks, resetKey, selectedIds, academicTaskTypes: [] }));
    expect(countRows(hook.current)).toBe(TASKS_PAGE_SIZE);

    selectedIds = new Set(tasks.map((t) => t.id));
    hook.rerender();
    expect(countRows(hook.current)).toBe(tasks.length);

    resetKey = 'b';
    hook.rerender();
    expect(countRows(hook.current)).toBe(tasks.length);

    selectedIds = new Set();
    resetKey = 'c';
    hook.rerender();
    expect(countRows(hook.current)).toBe(TASKS_PAGE_SIZE);
  });
});
