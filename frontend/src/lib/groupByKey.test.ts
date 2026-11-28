import { describe, expect, it } from 'vitest';
import { groupByKey } from './groupByKey';

describe('groupByKey', () => {
  it('groups by key and keeps the input order inside each group', () => {
    const items = [
      { day: 'a', n: 1 },
      { day: 'b', n: 2 },
      { day: 'a', n: 3 },
    ];
    const groups = groupByKey(items, (item) => item.day);
    expect([...groups.keys()]).toEqual(['a', 'b']);
    expect(groups.get('a')?.map((item) => item.n)).toEqual([1, 3]);
  });

  it('returns an empty map for no items', () => {
    expect(groupByKey([], String).size).toBe(0);
  });
});
