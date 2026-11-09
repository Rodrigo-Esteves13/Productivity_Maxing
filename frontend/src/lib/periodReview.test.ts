import { describe, expect, it } from 'vitest';
import { buildPeriodReview, historyDaysForPeriod, longestDayStreak, HISTORY_MAX_DAYS } from './periodReview';
import type { PeriodReportCard, StudySession, Task } from '../types/models';

function session(startedAt: string, durationSeconds: number | null): StudySession {
  return { id: startedAt, startedAt, durationSeconds } as StudySession;
}
const task = (completedAt: string | null) => ({ completedAt }) as Task;
const base = { card: null, tasks: [], sessions: [], startDate: null, endDate: null };

describe('longestDayStreak', () => {
  it('finds the longest consecutive run', () => {
    expect(longestDayStreak(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'])).toBe(3);
  });
  it('is 0 when empty and ignores duplicates', () => {
    expect(longestDayStreak([])).toBe(0);
    expect(longestDayStreak(['2026-03-01', '2026-03-01'])).toBe(1);
  });
});

describe('historyDaysForPeriod', () => {
  it('caps at the history limit and defaults without a start', () => {
    expect(historyDaysForPeriod(null)).toBe(HISTORY_MAX_DAYS);
    expect(historyDaysForPeriod('2020-01-01T00:00:00Z', new Date('2026-01-01'))).toBe(HISTORY_MAX_DAYS);
    expect(historyDaysForPeriod('2026-01-01T00:00:00Z', new Date('2026-01-11T00:00:00Z'))).toBe(11);
  });
});

describe('buildPeriodReview', () => {
  it('is empty with no data', () => {
    expect(buildPeriodReview(base)).toEqual([]);
  });

  it('counts completed tasks only', () => {
    const cards = buildPeriodReview({ ...base, tasks: [task('2026-03-01'), task(null), task('2026-03-02')] });
    expect(cards).toEqual([{ kind: 'tasksCompleted', count: 2 }]);
  });

  it('builds study cards and skips streak below the minimum', () => {
    const cards = buildPeriodReview({
      ...base,
      sessions: [session('2026-03-02T12:00:00', 3600), session('2026-03-04T12:00:00', 2400), session('2026-03-04T15:00:00', 1800)],
    });
    expect(cards.map((c) => c.kind)).toEqual(['studyTime', 'bestDay', 'bestWeekday']);
    expect(cards[0]).toEqual({ kind: 'studyTime', minutes: 130, sessionCount: 3 });
    expect(cards[1]).toMatchObject({ dayKey: '2026-03-04', minutes: 70 });
  });

  it('ignores sessions outside the period and active ones', () => {
    const cards = buildPeriodReview({
      ...base,
      startDate: '2026-03-01T00:00:00',
      endDate: '2026-03-31T00:00:00',
      sessions: [session('2026-02-10T12:00:00', 3600), session('2026-03-05T12:00:00', null)],
    });
    expect(cards).toEqual([]);
  });

  it('picks the best graded area', () => {
    const card = {
      areas: [
        { areaId: 'a', areaName: 'Math', credits: 6, average: 14, passed: true },
        { areaId: 'b', areaName: 'Physics', credits: 6, average: 17, passed: true },
        { areaId: 'c', areaName: 'Art', credits: 3, average: null, passed: false },
      ],
    } as PeriodReportCard;
    expect(buildPeriodReview({ ...base, card })).toEqual([{ kind: 'bestArea', areaName: 'Physics', average: 17 }]);
  });

  it('reports a streak of consecutive study days', () => {
    const cards = buildPeriodReview({
      ...base,
      sessions: [session('2026-03-02T12:00:00', 600), session('2026-03-03T12:00:00', 600), session('2026-03-04T12:00:00', 600)],
    });
    expect(cards.find((c) => c.kind === 'longestStreak')).toEqual({ kind: 'longestStreak', days: 3 });
  });
});
