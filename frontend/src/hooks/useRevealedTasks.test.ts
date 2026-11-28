import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserStubs, renderHook } from '../test/hookHarness';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);
vi.mock('react-dom', () => ({ flushSync: (fn: () => void) => fn() }));

import { TASKS_PAGE_SIZE, useRevealedTasks } from './useRevealedTasks';

const items = Array.from({ length: TASKS_PAGE_SIZE * 2 + 10 }, (_, i) => i);
let stubs: ReturnType<typeof createBrowserStubs>;

beforeEach(() => {
  stubs = createBrowserStubs();
  vi.stubGlobal('window', stubs.window);
});

describe('useRevealedTasks (F-49)', () => {
  it('reveals one page at a time and starts over when the key changes', () => {
    const hook = renderHook(() => useRevealedTasks(items, 'a'));
    expect(hook.current.visible).toHaveLength(TASKS_PAGE_SIZE);
    expect(hook.current.remaining).toBe(items.length - TASKS_PAGE_SIZE);
    hook.current.showMore();
    expect(hook.current.visible).toHaveLength(TASKS_PAGE_SIZE * 2);
    hook.rerender(() => useRevealedTasks(items, 'b'));
    expect(hook.current.visible).toHaveLength(TASKS_PAGE_SIZE);
  });

  it('keeps a given row visible', () => {
    const hook = renderHook(() => useRevealedTasks(items, 'a', TASKS_PAGE_SIZE + 1));
    expect(hook.current.visible).toHaveLength(TASKS_PAGE_SIZE * 2);
  });

  it('renders everything while printing', () => {
    const hook = renderHook(() => useRevealedTasks(items));
    stubs.window.dispatchEvent(new Event('beforeprint'));
    expect(hook.current.visible).toHaveLength(items.length);
    expect(hook.current.remaining).toBe(0);
    stubs.window.dispatchEvent(new Event('afterprint'));
    expect(hook.current.visible).toHaveLength(TASKS_PAGE_SIZE);
  });
});
