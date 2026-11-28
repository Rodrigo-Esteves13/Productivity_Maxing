import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../test/hookHarness';
import type { Task } from '../types/models';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);
const net = vi.hoisted(() => ({ fetchAllPages: vi.fn() }));
vi.mock('../api/fetchAllPages', () => net);
vi.mock('../api/client', () => ({ default: {} }));

import { TASKS_FRESH_MS } from '../api/catalogCache';
import { getUserTasks } from '../api/tasksService';
import { invalidateQueries, resetQueryCacheForTests } from '../api/queryCache';
import { resetDomainEventsForTests } from '../lib/domainEvents';
import { usePeriodTasks } from './usePeriodTasks';

const task = (id: string) => ({ id }) as Task;
const ids = (tasks: Task[]) => tasks.map((t) => t.id);
const settle = () => vi.advanceTimersByTimeAsync(0);

// Deixa uma copia velha de p1 na cache; o pedido seguinte revalida por tras.
async function mountOnStaleCopy() {
  net.fetchAllPages.mockResolvedValueOnce([task('old')]);
  await getUserTasks('p1');
  await vi.advanceTimersByTimeAsync(TASKS_FRESH_MS + 1);
  let revalidate: (tasks: Task[]) => void = () => {};
  net.fetchAllPages.mockReturnValueOnce(
    new Promise<Task[]>((resolve) => {
      revalidate = resolve;
    }),
  );
  let period = 'p1';
  const hook = renderHook(() => usePeriodTasks(period, false));
  await settle();
  expect(ids(hook.current.tasks)).toEqual(['old']);
  const switchTo = async (next: string) => {
    period = next;
    hook.rerender();
    await settle();
  };
  return { hook, revalidate: (tasks: Task[]) => revalidate(tasks), switchTo };
}

beforeEach(() => {
  vi.useFakeTimers();
  net.fetchAllPages.mockReset();
  resetQueryCacheForTests();
  resetDomainEventsForTests();
});

afterEach(() => vi.useRealTimers());

describe('usePeriodTasks with a stale cached copy', () => {
  it('shows the revalidated list without a skeleton or another request', async () => {
    const { hook, revalidate } = await mountOnStaleCopy();
    revalidate([task('new')]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ids(hook.current.tasks)).toEqual(['new']);
    expect(hook.current.isLoading).toBe(false);
    expect(net.fetchAllPages).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite a newer local change made by a write', async () => {
    const { hook, revalidate } = await mountOnStaleCopy();
    hook.current.setTasks([task('local')]);
    // O que o cliente HTTP faz em cada escrita (mutationInvalidation.ts).
    invalidateQueries();
    revalidate([task('new')]);
    await settle();
    expect(ids(hook.current.tasks)).toEqual(['local']);
  });

  it('ignores the revalidated list of a period no longer selected', async () => {
    const { hook, revalidate, switchTo } = await mountOnStaleCopy();
    net.fetchAllPages.mockResolvedValueOnce([task('p2')]);
    await switchTo('p2');
    revalidate([task('new')]);
    await settle();
    expect(ids(hook.current.tasks)).toEqual(['p2']);
  });
});
