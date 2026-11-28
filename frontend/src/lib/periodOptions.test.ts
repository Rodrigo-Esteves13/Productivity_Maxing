import { describe, expect, it } from 'vitest';
import { periodOptionLabel, sortPeriodsForSelect } from './periodOptions';

const p = (name: string, startDate: string, isArchived = false) => ({ name, startDate, isArchived });

describe('sortPeriodsForSelect', () => {
  it('orders newest first and archived last', () => {
    const sorted = sortPeriodsForSelect([
      p('old', '2024-09-01'),
      p('archived-new', '2026-09-01', true),
      p('new', '2026-02-01'),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(['new', 'old', 'archived-new']);
  });
  it('does not mutate the input', () => {
    const input = [p('a', '2024-01-01'), p('b', '2025-01-01')];
    sortPeriodsForSelect(input);
    expect(input[0].name).toBe('a');
  });
});

describe('periodOptionLabel', () => {
  it('tags archived periods only', () => {
    expect(periodOptionLabel(p('S1', '2025-01-01', true), '(archived)')).toBe('S1 (archived)');
    expect(periodOptionLabel(p('S1', '2025-01-01'), '(archived)')).toBe('S1');
  });
});
