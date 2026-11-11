import { describe, expect, it, beforeEach, vi } from 'vitest';
import { computeBadges, readBestStreak, rememberBestStreak } from './badges';

describe('computeBadges', () => {
  it('marks earned badges and caps progress at the target', () => {
    const badges = computeBadges({ completed: 12, streak: 2, projects: 0 });
    const find = (m: string, t: number) => badges.find((b) => b.metric === m && b.target === t)!;
    expect(find('completed', 10)).toMatchObject({ earned: true, value: 10 });
    expect(find('completed', 50)).toMatchObject({ earned: false, value: 12 });
    expect(find('streak', 3)).toMatchObject({ earned: false, value: 2 });
    expect(find('projects', 1).earned).toBe(false);
  });
});

describe('best streak', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  it('never goes down', () => {
    expect(rememberBestStreak(5)).toBe(5);
    expect(rememberBestStreak(2)).toBe(5);
    expect(readBestStreak()).toBe(5);
  });
});
