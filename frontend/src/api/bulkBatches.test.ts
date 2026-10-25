import { describe, expect, it } from 'vitest';
import { BULK_TASK_BATCH_SIZE, chunkIds } from './userService';

describe('chunkIds (B-07)', () => {
  it('splits a large selection into batches the backend accepts', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `t${i}`);
    const chunks = chunkIds(ids);
    expect(chunks.map((c) => c.length)).toEqual([BULK_TASK_BATCH_SIZE, BULK_TASK_BATCH_SIZE, 50]);
    expect(chunks.flat()).toEqual(ids);
  });

  it('returns no batch for an empty selection', () => {
    expect(chunkIds([])).toEqual([]);
  });
});
