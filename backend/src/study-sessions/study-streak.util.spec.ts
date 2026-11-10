import { walkStreak } from './study-streak.util';

const TODAY = '2026-11-10';

describe('walkStreak with claimed rest days', () => {
  it('without rest days, a missed day breaks the streak', () => {
    const active = new Set(['2026-11-06', '2026-11-07', '2026-11-09']);
    const walk = walkStreak(active, '2026-11-06', TODAY);
    expect(walk.currentStreak).toBe(1);
    expect(walk.longestStreak).toBe(2);
  });

  it('a rest day bridges a one-day gap', () => {
    const active = new Set(['2026-11-06', '2026-11-07', '2026-11-09']);
    const walk = walkStreak(
      active,
      '2026-11-06',
      TODAY,
      new Set(['2026-11-08']),
    );
    expect(walk.currentStreak).toBe(3);
  });

  it('a rest day does not count toward the length', () => {
    const active = new Set(['2026-11-08']);
    const walk = walkStreak(
      active,
      '2026-11-08',
      TODAY,
      new Set(['2026-11-09']),
    );
    expect(walk.currentStreak).toBe(1);
    expect(walk.longestStreak).toBe(1);
  });

  it('two consecutive gap days with one rest day still break the streak', () => {
    const active = new Set(['2026-11-05', '2026-11-06', '2026-11-09']);
    const walk = walkStreak(
      active,
      '2026-11-05',
      TODAY,
      new Set(['2026-11-07']),
    );
    expect(walk.currentStreak).toBe(1);
  });

  it('a rest day does not spend an earned freeze', () => {
    // 7 days in a row earn 1 freeze; the rest day must leave it banked.
    const active = new Set([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-09',
    ]);
    const walk = walkStreak(
      active,
      '2026-11-01',
      TODAY,
      new Set(['2026-11-08']),
    );
    expect(walk.currentStreak).toBe(8);
    expect(walk.freezesAvailable).toBe(1);
    expect(walk.freezesUsedTotal).toBe(0);
  });

  it('activity wins over a rest day on the same date', () => {
    const active = new Set(['2026-11-09']);
    const walk = walkStreak(
      active,
      '2026-11-09',
      TODAY,
      new Set(['2026-11-09']),
    );
    expect(walk.currentStreak).toBe(1);
  });
});
