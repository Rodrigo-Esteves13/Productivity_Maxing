import { describe, expect, it } from 'vitest';
import { restDaysLeft, restDayView } from './streakRestDay';
import type { StreakFreezeStatus } from '../api/streakFreezesService';

const base: StreakFreezeStatus = {
  todayKey: '2026-11-10',
  freezes: [],
  todayFreezeId: null,
  usedThisWeek: 0,
  maxPerWeek: 1,
  canFreezeToday: true,
};

describe('restDayView', () => {
  it('is hidden while the status is loading', () => {
    expect(restDayView(null)).toBe('hidden');
  });

  it('is available when today can be a rest day', () => {
    expect(restDayView(base)).toBe('available');
  });

  it('is active when today is already a rest day', () => {
    expect(
      restDayView({ ...base, todayFreezeId: 'f1', usedThisWeek: 1, canFreezeToday: false }),
    ).toBe('active');
  });

  it('is hidden when the cap is reached or there is activity today', () => {
    expect(restDayView({ ...base, canFreezeToday: false })).toBe('hidden');
  });
});

describe('restDaysLeft', () => {
  it('never goes below zero', () => {
    expect(restDaysLeft(base)).toBe(1);
    expect(restDaysLeft({ ...base, usedThisWeek: 2 })).toBe(0);
  });
});
