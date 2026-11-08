import { describe, expect, it } from 'vitest';
import { computeWeightVsGrade, pearson, MIN_WEIGHT_GRADE_SAMPLE } from './weightVsGrade';
import type { Task } from '../types/models';

const task = (weightPercentage: number | null, realGrade: number | null) =>
  ({ weightPercentage, realGrade }) as Task;

describe('pearson', () => {
  it('returns 1 for a perfect positive line', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
  });

  it('returns null below the minimum sample', () => {
    const xs = Array.from({ length: MIN_WEIGHT_GRADE_SAMPLE - 1 }, (_, i) => i);
    expect(pearson(xs, xs)).toBeNull();
  });

  it('returns null with zero variance', () => {
    expect(pearson([5, 5, 5, 5], [10, 12, 14, 16])).toBeNull();
  });
});

describe('computeWeightVsGrade', () => {
  it('ignores tasks without weight or grade and buckets the rest', () => {
    const result = computeWeightVsGrade([
      task(5, 10),
      task(20, 14),
      task(30, 17),
      task(40, 19),
      task(null, 15),
      task(10, null),
    ]);
    expect(result.sampleCount).toBe(4);
    expect(result.kind).toBe('higherOnHeavy');
    expect(result.buckets.find((b) => b.id === 'heavy')).toEqual({ id: 'heavy', count: 2, averageGrade: 18 });
  });

  it('reports lower grades on heavier weights', () => {
    const result = computeWeightVsGrade([task(5, 18), task(15, 15), task(30, 12), task(40, 9)]);
    expect(result.kind).toBe('lowerOnHeavy');
    expect(result.coefficient).toBeLessThan(0);
  });

  it('has no coefficient when the sample is too small', () => {
    const result = computeWeightVsGrade([task(10, 12), task(20, 14)]);
    expect(result.coefficient).toBeNull();
    expect(result.kind).toBeNull();
  });
});
