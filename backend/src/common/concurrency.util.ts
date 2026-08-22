/**
 * Runs `worker` over every item in `items`, at most `concurrency` calls in
 * flight at once, and returns results in the same order as `items` -
 * regardless of which call finishes first.
 *
 * Exists for exactly one reason: a handful of endpoints (task import being
 * the first) need to do N independent DB writes that don't depend on each
 * other, where N can be in the hundreds. Fully sequential (`for...await`)
 * wastes time waiting on each round-trip one at a time; a bare
 * `Promise.all` fires all N at once and can exhaust the DB connection
 * pool under load. This is the middle ground, with no new dependency
 * (p-limit and friends are one npm install away, but this is ~15 lines).
 *
 * IMPORTANT: `worker` must never reject/throw - if it does, this whole
 * `Promise.all` rejects and every other in-flight item is abandoned mid-
 * batch. For per-item partial-success semantics (task import's actual
 * requirement), catch inside `worker` and return a result object that
 * encodes success/failure instead.
 */
export async function runWithConcurrencyLimit<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  // `new Array(n)` (no generic) is typed `any[]` by the built-in Array
  // constructor's ambient types - assigning that to `TResult[]` is
  // exactly what @typescript-eslint/no-unsafe-assignment exists to catch.
  // `new Array<TResult>(n)` uses the generic overload instead, so this is
  // properly typed from the start rather than relying on later
  // assignments to narrow it.
  const results: TResult[] = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const currentIndex = nextIndex++;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    return runNext();
  }

  // Spin up `concurrency` workers (or fewer if there's less work than
  // that) that each keep pulling the next index until the queue drains.
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));

  return results;
}
