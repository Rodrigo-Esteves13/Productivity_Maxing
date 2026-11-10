import { describe, expect, it } from 'vitest';
import { isDefaultOrder, moveItem, normalizeOrder, resetOrder } from './widgetOrder';

const DEFAULTS = ['a', 'b', 'c', 'd'] as const;

describe('normalizeOrder', () => {
  it('returns defaults for non-array input', () => {
    expect(normalizeOrder(null, DEFAULTS)).toEqual(['a', 'b', 'c', 'd']);
    expect(normalizeOrder('x', DEFAULTS)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('keeps a valid stored order', () => {
    expect(normalizeOrder(['d', 'c', 'b', 'a'], DEFAULTS)).toEqual(['d', 'c', 'b', 'a']);
  });
  it('drops unknown ids, non-strings and duplicates', () => {
    expect(normalizeOrder(['c', 'zzz', 3, 'c', 'a', 'b', 'd'], DEFAULTS)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('inserts missing ids after their default predecessor', () => {
    expect(normalizeOrder(['d', 'a', 'c'], DEFAULTS)).toEqual(['d', 'a', 'b', 'c']);
  });
  it('puts a missing first id at the front', () => {
    expect(normalizeOrder(['c', 'b', 'd'], DEFAULTS)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('handles an empty stored list', () => {
    expect(normalizeOrder([], DEFAULTS)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('moveItem', () => {
  it('moves up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });
  it('is a no-op at the ends and for unknown ids', () => {
    expect(moveItem(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 'x', 1)).toEqual(['a', 'b']);
  });
  it('does not mutate the input', () => {
    const input = ['a', 'b'];
    moveItem(input, 'a', 1);
    expect(input).toEqual(['a', 'b']);
  });
});

describe('resetOrder / isDefaultOrder', () => {
  it('returns a copy of the defaults', () => {
    const reset = resetOrder(DEFAULTS);
    expect(reset).toEqual(['a', 'b', 'c', 'd']);
    expect(reset).not.toBe(DEFAULTS);
  });
  it('detects the default order', () => {
    expect(isDefaultOrder(['a', 'b', 'c', 'd'], DEFAULTS)).toBe(true);
    expect(isDefaultOrder(['b', 'a', 'c', 'd'], DEFAULTS)).toBe(false);
  });
});
