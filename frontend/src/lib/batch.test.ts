import { describe, expect, it } from 'vitest';
import { settleInBatches } from './batch';

describe('settleInBatches', () => {
  it('never runs more than the batch size at once', async () => {
    let running = 0;
    let peak = 0;
    const outcome = await settleInBatches(
      [1, 2, 3, 4, 5],
      async (n) => {
        running += 1;
        peak = Math.max(peak, running);
        await Promise.resolve();
        running -= 1;
        return n * 2;
      },
      2,
    );
    expect(peak).toBe(2);
    expect(outcome.done.map((d) => d.value)).toEqual([2, 4, 6, 8, 10]);
    expect(outcome.failed).toEqual([]);
  });

  it('keeps going after a failure and reports it', async () => {
    const outcome = await settleInBatches(
      ['a', 'b', 'c'],
      (item) => (item === 'b' ? Promise.reject(new Error('x')) : Promise.resolve(item)),
      1,
    );
    expect(outcome.done.map((d) => d.item)).toEqual(['a', 'c']);
    expect(outcome.failed).toEqual(['b']);
  });
});
