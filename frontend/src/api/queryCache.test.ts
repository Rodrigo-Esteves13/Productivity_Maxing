import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCancel } from 'axios';
import {
  cachedQuery,
  clearQueryCache,
  forgetLastKnown,
  invalidateQueries,
  patchLastKnown,
  peekLastKnown,
  receiveBroadcastForTests,
  resetQueryCacheForTests,
  setQueryCacheOwner,
  type QueryOptions,
} from './queryCache';

const FRESH_MS = 1000;
const STALE_MS = 5000;
const KNOWN_MAX_AGE_MS = 60_000;

const copyList = (list: string[]) => [...list];

function options(extra: Partial<QueryOptions<string[]>> = {}): QueryOptions<string[]> {
  return { freshMs: FRESH_MS, staleMs: STALE_MS, clone: copyList, ...extra };
}

// Rede falsa: cada pedido fica pendente ate resolve(i, valor).
function fakeFetcher() {
  const calls: { signal: AbortSignal; resolve: (value: string[]) => void; reject: (error: unknown) => void }[] = [];
  const fetcher = vi.fn(
    (signal: AbortSignal) =>
      new Promise<string[]>((resolve, reject) => {
        calls.push({ signal, resolve, reject });
      }),
  );
  return { fetcher, calls };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('queryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T10:00:00Z'));
    resetQueryCacheForTests();
  });

  afterEach(() => {
    resetQueryCacheForTests();
    vi.useRealTimers();
  });

  it('serves a fresh entry without going to the network', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['a']);
    await expect(first).resolves.toEqual(['a']);
    vi.advanceTimersByTime(FRESH_MS - 1);
    await expect(cachedQuery('k', fetcher, options())).resolves.toEqual(['a']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers while it is in flight', async () => {
    const { fetcher, calls } = fakeFetcher();
    const a = cachedQuery('k', fetcher, options());
    const b = cachedQuery('k', fetcher, options());
    calls[0].resolve(['a']);
    await expect(Promise.all([a, b])).resolves.toEqual([['a'], ['a']]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('hands every caller its own copy', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['a']);
    const list = await first;
    list.push('mutated');
    await expect(cachedQuery('k', fetcher, options())).resolves.toEqual(['a']);
  });

  it('returns the stale copy and revalidates in the background', async () => {
    const onRevalidated = vi.fn();
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options({ onRevalidated }));
    calls[0].resolve(['old']);
    await first;
    vi.advanceTimersByTime(FRESH_MS);
    await expect(cachedQuery('k', fetcher, options({ onRevalidated }))).resolves.toEqual(['old']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Um segundo pedido velho nao abre outra revalidacao.
    await expect(cachedQuery('k', fetcher, options({ onRevalidated }))).resolves.toEqual(['old']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    calls[1].resolve(['new']);
    await settle();
    expect(onRevalidated).toHaveBeenCalledTimes(1);
    await expect(cachedQuery('k', fetcher, options({ onRevalidated }))).resolves.toEqual(['new']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not announce a revalidation that brought the same data', async () => {
    const onRevalidated = vi.fn();
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options({ onRevalidated }));
    calls[0].resolve(['same']);
    await first;
    vi.advanceTimersByTime(FRESH_MS);
    await cachedQuery('k', fetcher, options({ onRevalidated }));
    calls[1].resolve(['same']);
    await settle();
    expect(onRevalidated).not.toHaveBeenCalled();
  });

  it('keeps the stale copy when the background revalidation fails', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['old']);
    await first;
    vi.advanceTimersByTime(FRESH_MS);
    await cachedQuery('k', fetcher, options());
    calls[1].reject(new Error('offline'));
    await settle();
    await expect(cachedQuery('k', fetcher, options())).resolves.toEqual(['old']);
  });

  it('goes to the network once the entry is past the stale window', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['old']);
    await first;
    vi.advanceTimersByTime(STALE_MS);
    const again = cachedQuery('k', fetcher, options());
    calls[1].resolve(['new']);
    await expect(again).resolves.toEqual(['new']);
  });

  it('never caches a failed request', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].reject(new Error('500'));
    await expect(first).rejects.toThrow('500');
    const again = cachedQuery('k', fetcher, options());
    calls[1].resolve(['ok']);
    await expect(again).resolves.toEqual(['ok']);
  });

  it('asks the network again after an invalidation', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['before']);
    await first;
    invalidateQueries(undefined, { broadcast: false });
    const after = cachedQuery('k', fetcher, options());
    calls[1].resolve(['after']);
    await expect(after).resolves.toEqual(['after']);
  });

  it('only invalidates the keys that match', async () => {
    const { fetcher, calls } = fakeFetcher();
    const a = cachedQuery('tasks|', fetcher, options());
    const b = cachedQuery('areas|', fetcher, options());
    calls[0].resolve(['t']);
    calls[1].resolve(['a']);
    await Promise.all([a, b]);
    invalidateQueries((key) => key.startsWith('tasks'), { broadcast: false });
    await cachedQuery('areas|', fetcher, options());
    expect(fetcher).toHaveBeenCalledTimes(2);
    void cachedQuery('tasks|', fetcher, options());
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('never stores a response that was in flight when the data was invalidated', async () => {
    const { fetcher, calls } = fakeFetcher();
    const early = cachedQuery('k', fetcher, options());
    invalidateQueries(undefined, { broadcast: false });
    // Quem pede depois da escrita nao se junta ao pedido antigo.
    const late = cachedQuery('k', fetcher, options());
    expect(fetcher).toHaveBeenCalledTimes(2);
    calls[1].resolve(['after-write']);
    await expect(late).resolves.toEqual(['after-write']);
    // A resposta antiga chega depois e e entregue so a quem a pediu.
    calls[0].resolve(['before-write']);
    await expect(early).resolves.toEqual(['before-write']);
    await expect(cachedQuery('k', fetcher, options())).resolves.toEqual(['after-write']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('drops a background revalidation that an invalidation overtook', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['v1']);
    await first;
    vi.advanceTimersByTime(FRESH_MS);
    await cachedQuery('k', fetcher, options());
    invalidateQueries(undefined, { broadcast: false });
    expect(calls[1].signal.aborted).toBe(true);
    calls[1].resolve(['v2-before-write']);
    const next = cachedQuery('k', fetcher, options());
    calls[2].resolve(['v3']);
    await expect(next).resolves.toEqual(['v3']);
  });

  it('cancels only the caller that aborted', async () => {
    const { fetcher, calls } = fakeFetcher();
    const controller = new AbortController();
    const aborted = cachedQuery('k', fetcher, options(), { signal: controller.signal });
    const kept = cachedQuery('k', fetcher, options());
    controller.abort();
    await expect(aborted).rejects.toSatisfy(isCancel);
    expect(calls[0].signal.aborted).toBe(false);
    calls[0].resolve(['ok']);
    await expect(kept).resolves.toEqual(['ok']);
  });

  it('cancels the network request when every caller gave up', async () => {
    const { fetcher, calls } = fakeFetcher();
    const one = new AbortController();
    const two = new AbortController();
    const a = cachedQuery('k', fetcher, options(), { signal: one.signal });
    const b = cachedQuery('k', fetcher, options(), { signal: two.signal });
    one.abort();
    expect(calls[0].signal.aborted).toBe(false);
    two.abort();
    expect(calls[0].signal.aborted).toBe(true);
    await expect(a).rejects.toSatisfy(isCancel);
    await expect(b).rejects.toSatisfy(isCancel);
    // O proximo pedido comeca de novo.
    void cachedQuery('k', fetcher, options());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects at once for a signal that is already aborted', async () => {
    const { fetcher } = fakeFetcher();
    const controller = new AbortController();
    controller.abort();
    await expect(cachedQuery('k', fetcher, options(), { signal: controller.signal })).rejects.toSatisfy(isCancel);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('force skips the cached copy and older requests', async () => {
    const { fetcher, calls } = fakeFetcher();
    const first = cachedQuery('k', fetcher, options());
    calls[0].resolve(['cached']);
    await first;
    const forced = cachedQuery('k', fetcher, options(), { force: true });
    calls[1].resolve(['forced']);
    await expect(forced).resolves.toEqual(['forced']);
    await expect(cachedQuery('k', fetcher, options())).resolves.toEqual(['forced']);
  });

  describe('logout and user changes', () => {
    it('clears everything and ignores responses from before the clear', async () => {
      const { fetcher, calls } = fakeFetcher();
      const cached = cachedQuery('a', fetcher, options());
      calls[0].resolve(['user-a']);
      await cached;
      const inFlight = cachedQuery('b', fetcher, options());
      clearQueryCache({ broadcast: false });
      calls[1].resolve(['user-a-late']);
      await inFlight;
      void cachedQuery('a', fetcher, options());
      void cachedQuery('b', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it('clears when the owner changes to another user or to nobody', async () => {
      const { fetcher, calls } = fakeFetcher();
      setQueryCacheOwner('user-a');
      const first = cachedQuery('k', fetcher, options());
      calls[0].resolve(['a']);
      await first;
      setQueryCacheOwner('user-a');
      await cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(1);
      setQueryCacheOwner('user-b');
      void cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(2);
      calls[1].resolve(['b']);
      await settle();
      setQueryCacheOwner(null);
      void cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('keeps what was loaded before the profile arrived (nobody to a user)', async () => {
      const { fetcher, calls } = fakeFetcher();
      const first = cachedQuery('k', fetcher, options());
      calls[0].resolve(['mine']);
      await first;
      setQueryCacheOwner('user-a');
      await cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('forgets the last known value too', async () => {
      const { fetcher, calls } = fakeFetcher();
      const first = cachedQuery('k', fetcher, options({ keepLastKnown: true }));
      calls[0].resolve(['a']);
      await first;
      clearQueryCache({ broadcast: false });
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toBeUndefined();
    });
  });

  describe('other tabs', () => {
    it('invalidates on a message from another tab', async () => {
      const { fetcher, calls } = fakeFetcher();
      const first = cachedQuery('k', fetcher, options({ keepLastKnown: true }));
      calls[0].resolve(['a']);
      await first;
      receiveBroadcastForTests('invalidate');
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toBeUndefined();
      void cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('clears on a clear message from another tab', async () => {
      const { fetcher, calls } = fakeFetcher();
      const first = cachedQuery('k', fetcher, options());
      calls[0].resolve(['a']);
      await first;
      receiveBroadcastForTests('clear');
      void cachedQuery('k', fetcher, options());
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('last known value', () => {
    async function loadKnown(value: string[]) {
      const { fetcher, calls } = fakeFetcher();
      const first = cachedQuery('k', fetcher, options({ keepLastKnown: true }));
      calls[0].resolve(value);
      await first;
    }

    it('survives an invalidation that keeps it and takes patches', async () => {
      await loadKnown(['a']);
      invalidateQueries(undefined, { keepLastKnown: true, broadcast: false });
      patchLastKnown<string[]>('k', (list) => [...list, 'b']);
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toEqual(['a', 'b']);
    });

    it('is dropped by a plain invalidation', async () => {
      await loadKnown(['a']);
      invalidateQueries(undefined, { broadcast: false });
      patchLastKnown<string[]>('k', (list) => [...list, 'b']);
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toBeUndefined();
    });

    it('is not served once too old, and can be forgotten', async () => {
      await loadKnown(['a']);
      vi.advanceTimersByTime(KNOWN_MAX_AGE_MS);
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toBeUndefined();
      await loadKnown(['b']);
      forgetLastKnown('k');
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toBeUndefined();
    });

    it('hands out copies', async () => {
      await loadKnown(['a']);
      peekLastKnown<string[]>('k', KNOWN_MAX_AGE_MS, copyList)?.push('x');
      expect(peekLastKnown('k', KNOWN_MAX_AGE_MS, copyList)).toEqual(['a']);
    });
  });
});
