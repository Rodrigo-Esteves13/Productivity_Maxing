import { describe, expect, it } from 'vitest';
import { computeDifficultyVsGrade } from './difficultyVsGrade';
import type { Task } from '../types/models';

const task = (difficulty: Task['difficulty'], realGrade: number | null, targetGrade: number | null = null) =>
  ({ difficulty, realGrade, targetGrade }) as Task;

describe('computeDifficultyVsGrade', () => {
  it('averages real grades and the gap to target per level', () => {
    const result = computeDifficultyVsGrade([
      task('EASY', 16, 15),
      task('EASY', 18),
      task('HARD', 11, 14),
      task('VERY_HARD', 9),
      task('MEDIUM', null),
    ]);
    expect(result.gradedCount).toBe(4);
    const easy = result.buckets.find((b) => b.difficulty === 'EASY');
    expect(easy).toEqual({ difficulty: 'EASY', count: 2, averageGrade: 17, averageVsTarget: 1 });
    const medium = result.buckets.find((b) => b.difficulty === 'MEDIUM');
    expect(medium?.averageGrade).toBeNull();
    expect(result.hardMinusEasy).toBe(-7);
  });

  it('has no comparison without both easy and hard grades', () => {
    expect(computeDifficultyVsGrade([task('EASY', 15)]).hardMinusEasy).toBeNull();
  });
});
