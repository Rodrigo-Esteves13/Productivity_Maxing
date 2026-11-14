import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { suggestDifficulty } from './difficultySuggestion';

const ORDER = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

function task(over: Partial<Task>): Task {
  return { areaId: 'a1', type: 'ASSIGNMENT', progressStatus: 'COMPLETED', difficulty: 'HARD', ...over } as Task;
}

describe('suggestDifficulty', () => {
  const match = { areaId: 'a1', type: 'ASSIGNMENT' };

  it('suggests the most common difficulty of similar finished tasks', () => {
    const tasks = [task({}), task({}), task({ difficulty: 'EASY' })];
    expect(suggestDifficulty(tasks, match, ORDER)).toEqual({ difficulty: 'HARD', basedOn: 3 });
  });

  it('needs enough similar tasks', () => {
    expect(suggestDifficulty([task({}), task({})], match, ORDER)).toBeNull();
  });

  it('ignores other courses, other types and unfinished tasks', () => {
    const tasks = [
      task({ areaId: 'a2' }),
      task({ type: 'EXAM' }),
      task({ progressStatus: 'NOT_STARTED' }),
      task({}),
      task({}),
    ];
    expect(suggestDifficulty(tasks, match, ORDER)).toBeNull();
  });

  it('breaks ties by catalog order', () => {
    const tasks = [task({ difficulty: 'EASY' }), task({ difficulty: 'EASY' }), task({ difficulty: 'HARD' }), task({ difficulty: 'HARD' })];
    expect(suggestDifficulty(tasks, match, ORDER)?.difficulty).toBe('EASY');
  });

  it('returns null without a course or type', () => {
    expect(suggestDifficulty([task({})], { areaId: '', type: 'ASSIGNMENT' }, ORDER)).toBeNull();
  });
});
