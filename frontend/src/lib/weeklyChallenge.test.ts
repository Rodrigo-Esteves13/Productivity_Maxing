import { describe, expect, it } from 'vitest';
import {
  WEEKLY_CHALLENGE_DEFAULT_TARGET,
  WEEKLY_CHALLENGE_MAX_TARGET,
  WEEKLY_CHALLENGE_MIN_TARGET,
  clampTarget,
  computeWeeklyChallenge,
} from './weeklyChallenge';

// Quarta-feira 2026-11-11 12:00 local; a semana comeca a segunda 2026-11-09.
const NOW = new Date(2026, 10, 11, 12);
const done = (y: number, m: number, d: number) => ({
  progressStatus: 'COMPLETED',
  completedAt: new Date(y, m, d, 10).toISOString(),
});
const many = (count: number, y: number, m: number, d: number) =>
  Array.from({ length: count }, () => done(y, m, d));

describe('computeWeeklyChallenge', () => {
  it('uses the default target with no history', () => {
    const r = computeWeeklyChallenge([], NOW);
    expect(r.target).toBe(WEEKLY_CHALLENGE_DEFAULT_TARGET);
    expect(r.status).toBe('noHistory');
    expect(r.progress).toBe(0);
  });

  it('target is round(avg of 3 prior weeks) + 1', () => {
    // 9 tasks nas 3 semanas anteriores -> media 3 -> meta 4.
    const tasks = [...many(4, 2026, 10, 3), ...many(3, 2026, 9, 27), ...many(2, 2026, 9, 20)];
    const r = computeWeeklyChallenge(tasks, NOW);
    expect(r.target).toBe(4);
    expect(r.status).toBe('inProgress');
  });

  it('counts only current-week completions as progress, Monday boundary', () => {
    const tasks = [
      ...many(3, 2026, 10, 9),
      done(2026, 10, 8), // domingo anterior: semana passada
      { progressStatus: 'PENDING', completedAt: null },
    ];
    const r = computeWeeklyChallenge(tasks, NOW);
    expect(r.progress).toBe(3);
  });

  it('is done when target reached and percent is capped', () => {
    const r = computeWeeklyChallenge(many(WEEKLY_CHALLENGE_DEFAULT_TARGET + 2, 2026, 10, 10), NOW);
    expect(r.status).toBe('done');
    expect(r.percent).toBe(100);
  });

  it('clamps the target to min and max', () => {
    expect(clampTarget(0)).toBe(WEEKLY_CHALLENGE_MIN_TARGET);
    expect(clampTarget(999)).toBe(WEEKLY_CHALLENGE_MAX_TARGET);
    const heavy = many(90, 2026, 10, 3);
    expect(computeWeeklyChallenge(heavy, NOW).target).toBe(WEEKLY_CHALLENGE_MAX_TARGET);
  });

  it('ignores completions older than 3 full weeks', () => {
    const r = computeWeeklyChallenge(many(5, 2026, 9, 5), NOW);
    expect(r.status).toBe('noHistory');
  });

  it('counts days left including today', () => {
    expect(computeWeeklyChallenge([], NOW).daysLeft).toBe(5);
    expect(computeWeeklyChallenge([], new Date(2026, 10, 9, 8)).daysLeft).toBe(7);
    expect(computeWeeklyChallenge([], new Date(2026, 10, 15, 8)).daysLeft).toBe(1);
  });
});
