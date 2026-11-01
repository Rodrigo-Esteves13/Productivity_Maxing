import { describe, expect, it } from 'vitest';
import { buildCategorySlices, OTHER_KEY } from './financeChart';
import { formatBucketLabel, formatPercent, monthsRange, parseQuantity } from './money';

describe('parseQuantity', () => {
  it('accepts comma and dot decimals up to 6 places', () => {
    expect(parseQuantity('0,666152')).toBe('0.666152');
    expect(parseQuantity(' 2 ')).toBe('2');
  });
  it('rejects zero, negatives, too many decimals and text', () => {
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('0.1234567')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
  });
});

describe('formatPercent', () => {
  it('formats a percentage value with one decimal', () => {
    expect(formatPercent(66.6152, 'en')).toBe('66.6%');
  });
});

describe('monthsRange', () => {
  it('spans from the first day N-1 months back to the last day of this month', () => {
    expect(monthsRange(3, new Date(2026, 10, 15))).toEqual({ from: '2026-09-01', to: '2026-11-30' });
  });
  it('crosses year boundaries', () => {
    expect(monthsRange(6, new Date(2026, 1, 10))).toEqual({ from: '2025-09-01', to: '2026-02-28' });
  });
});

describe('formatBucketLabel', () => {
  it('labels month buckets without a day', () => {
    expect(formatBucketLabel('2026-09', 'month', 'en')).toMatch(/Sep/);
  });
  it('labels week buckets with the day', () => {
    expect(formatBucketLabel('2026-09-07', 'week', 'en')).toMatch(/7/);
  });
});

describe('buildCategorySlices', () => {
  it('sums buckets, sorts by spend and folds the tail into other', () => {
    const cats = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const series = [{ expensesByCategory: Object.fromEntries(cats.map((c, i) => [c, (i + 1) * 100])) }, { expensesByCategory: { A: 50 } }];
    const slices = buildCategorySlices(series);
    expect(slices[0].key).toBe('H');
    expect(slices).toHaveLength(7);
    expect(slices[6]).toMatchObject({ key: OTHER_KEY, cents: 100 + 50 + 200 });
  });
  it('is empty without spending', () => {
    expect(buildCategorySlices([{ expensesByCategory: {} }])).toEqual([]);
  });
});
