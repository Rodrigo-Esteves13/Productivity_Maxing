import { describe, expect, it } from 'vitest';
import type { Area, Task } from '../types/models';
import { bucketForScore, computeAreaConsistency, standardDeviation } from './areaConsistency';

const MAX = 20;
const area = (id: string, name = id) => ({ id, name }) as unknown as Area;
const task = (areaId: string, realGrade: number | null, extra: Partial<Task> = {}) =>
  ({
    areaId,
    realGrade,
    progressStatus: 'COMPLETED',
    onTime: true,
    ...extra,
  }) as unknown as Task;
const many = (areaId: string, grades: number[]) => grades.map((g) => task(areaId, g));

describe('areaConsistency', () => {
  it('zero variance and all on time scores 100', () => {
    const [r] = computeAreaConsistency(many('a', [15, 15, 15]), [area('a')], MAX);
    expect(r.score).toBe(100);
    expect(r.bucket).toBe('steady');
    expect(standardDeviation([4, 4, 4])).toBe(0);
  });

  it('skips areas under the minimum sample and ungraded tasks', () => {
    const tasks = [...many('a', [10, 12]), task('a', null), ...many('b', [10, 10, 10])];
    const out = computeAreaConsistency(tasks, [area('a'), area('b')], MAX);
    expect(out.map((r) => r.areaId)).toEqual(['b']);
  });

  it('ranks steady above volatile', () => {
    const tasks = [...many('wild', [2, 20, 3, 19]), ...many('calm', [14, 15, 14, 15])];
    const out = computeAreaConsistency(tasks, [area('wild'), area('calm')], MAX);
    expect(out.map((r) => r.areaId)).toEqual(['calm', 'wild']);
    expect(out[1].bucket).toBe('volatile');
  });

  it('breaks ties by sample size then name', () => {
    const tasks = [...many('b', [10, 10, 10]), ...many('a', [10, 10, 10]), ...many('c', [10, 10, 10, 10])];
    const out = computeAreaConsistency(tasks, [area('b'), area('a'), area('c')], MAX);
    expect(out.map((r) => r.areaId)).toEqual(['c', 'a', 'b']);
  });

  it('late tasks lower the score; buckets map by threshold', () => {
    const late = [10, 10, 10].map((g) => task('a', g, { onTime: false }));
    const [r] = computeAreaConsistency(late, [area('a')], MAX);
    expect(r.score).toBe(70);
    expect(bucketForScore(69)).toBe('mixed');
    expect(bucketForScore(44)).toBe('volatile');
  });
});
