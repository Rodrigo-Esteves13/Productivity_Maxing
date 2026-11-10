import { describe, expect, it } from 'vitest';
import {
  XP_BASE_PER_TASK,
  XP_DIFFICULTY_BONUS,
  XP_ON_TIME_BONUS,
  computeXpLevel,
  levelFromXp,
  xpForLevel,
  xpForTask,
} from './xpLevel';
import type { Task } from '../types/models';

function task(overrides: Partial<Task>): Task {
  return {
    progressStatus: 'COMPLETED',
    difficulty: 'MEDIUM',
    onTime: false,
    submissionOnTime: null,
    academicTypeIsEvent: false,
    completedAt: '2026-11-05T10:00:00.000Z',
    date: '2026-11-04T00:00:00.000Z',
    ...overrides,
  } as unknown as Task;
}

describe('xpLevel', () => {
  it('zero tasks gives level 1 with 0 xp', () => {
    expect(computeXpLevel([])).toEqual({
      xp: 0,
      level: 1,
      xpIntoLevel: 0,
      xpForNext: xpForLevel(1),
      percent: 0,
    });
  });

  it('ignores tasks that are not completed', () => {
    expect(xpForTask(task({ progressStatus: 'NOT_STARTED' }))).toBe(0);
  });

  it('adds the on-time bonus', () => {
    const late = xpForTask(task({ onTime: false }));
    const onTime = xpForTask(task({ onTime: true }));
    expect(late).toBe(XP_BASE_PER_TASK + XP_DIFFICULTY_BONUS.MEDIUM);
    expect(onTime - late).toBe(XP_ON_TIME_BONUS);
  });

  it('harder tasks give more xp', () => {
    expect(xpForTask(task({ difficulty: 'VERY_HARD' }))).toBeGreaterThan(
      xpForTask(task({ difficulty: 'VERY_EASY' })),
    );
  });

  it('respects level boundaries', () => {
    const edge = xpForLevel(1);
    expect(levelFromXp(edge - 1).level).toBe(1);
    expect(levelFromXp(edge).level).toBe(2);
    expect(levelFromXp(edge).xpIntoLevel).toBe(0);
    expect(levelFromXp(xpForLevel(2) - 1).level).toBe(2);
    expect(levelFromXp(xpForLevel(2)).level).toBe(3);
  });

  it('is monotonic in xp and thresholds', () => {
    let prevLevel = 0;
    for (let xp = 0; xp < 2000; xp += 7) {
      const { level, percent } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prevLevel);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
      prevLevel = level;
    }
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4));
  });
});
