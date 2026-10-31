import { describe, expect, it } from 'vitest';
import { createLatestWinsQueue } from './latestWinsQueue';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createLatestWinsQueue', () => {
  it('runs tasks of the same key in order and skips superseded ones', async () => {
    const enqueue = createLatestWinsQueue();
    const calls: number[] = [];
    const first = deferred();
    const p1 = enqueue('a:f', async () => {
      calls.push(1);
      await first.promise;
    });
    await Promise.resolve();
    await Promise.resolve();
    const p2 = enqueue('a:f', async () => {
      calls.push(2);
    });
    const p3 = enqueue('a:f', async () => {
      calls.push(3);
    });
    first.resolve();
    expect(await Promise.all([p1, p2, p3])).toEqual(['done', 'superseded', 'done']);
    expect(calls).toEqual([1, 3]);
  });

  it('does not block other keys', async () => {
    const enqueue = createLatestWinsQueue();
    const slow = deferred();
    const calls: string[] = [];
    const a = enqueue('a:f', async () => {
      await slow.promise;
      calls.push('a');
    });
    await enqueue('b:f', async () => {
      calls.push('b');
    });
    expect(calls).toEqual(['b']);
    slow.resolve();
    await a;
  });

  it('keeps going after a failed task', async () => {
    const enqueue = createLatestWinsQueue();
    const bad = enqueue('k', async () => {
      throw new Error('x');
    });
    await expect(bad).rejects.toThrow('x');
    await expect(enqueue('k', async () => undefined)).resolves.toBe('done');
  });
});
