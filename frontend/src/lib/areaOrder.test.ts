import { describe, expect, it } from 'vitest';
import { moveAreaId, sortByAreaOrder } from './areaOrder';

const areas = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((a) => a.id);

describe('sortByAreaOrder', () => {
  it('keeps the original order without a saved order', () => {
    expect(ids(sortByAreaOrder(areas, []))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts saved ids first and new areas at the end, ignoring deleted ids', () => {
    expect(ids(sortByAreaOrder(areas, ['c', 'gone', 'a']))).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('moveAreaId', () => {
  it('moves forward and backward onto the target position', () => {
    expect(moveAreaId(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveAreaId(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('ignores unknown ids', () => {
    expect(moveAreaId(['a', 'b'], 'x', 'a')).toEqual(['a', 'b']);
  });
});
