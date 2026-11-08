import { describe, expect, it } from 'vitest';
import type { DistractionHourBucket } from '../api/studySessionsService';
import { computeFocusHours, FOCUS_HOURS_MIN_GAP_RATIO } from './focusHours';

function bucket(hour: number, rate: number, totalMinutes = 60, lowSample = false): DistractionHourBucket {
  return { hour, sessions: 5, totalMinutes, distractions: 1, focusHours: totalMinutes / 60, distractionsPerHour: rate, lowSample };
}

// 11:30 UTC in July = 12:30 Lisbon.
const NOW_12 = new Date('2026-07-04T11:30:00.000Z');

describe('computeFocusHours', () => {
  it('picks best and worst and flags the current Lisbon hour', () => {
    const r = computeFocusHours([bucket(9, 3), bucket(12, 0.5), bucket(15, 4)], NOW_12);
    expect(r).toMatchObject({ bestHour: 12, worstHour: 15, nowIsBest: true, nowIsWorst: false });
  });

  it('flags the worst hour', () => {
    const r = computeFocusHours([bucket(9, 3), bucket(10, 0.5), bucket(12, 4)], NOW_12);
    expect(r).toMatchObject({ bestHour: 10, worstHour: 12, nowIsBest: false, nowIsWorst: true });
  });

  it('breaks ties by more focus minutes', () => {
    const r = computeFocusHours([bucket(9, 1, 30), bucket(10, 1, 90), bucket(11, 5, 60)], NOW_12);
    expect(r?.bestHour).toBe(10);
  });

  it('ignores low-sample buckets', () => {
    const r = computeFocusHours([bucket(9, 0, 60, true), bucket(10, 1), bucket(11, 2), bucket(12, 5)], NOW_12);
    expect(r?.bestHour).toBe(10);
  });

  it('returns null with too few reliable buckets', () => {
    expect(computeFocusHours([bucket(9, 1), bucket(10, 5), bucket(11, 0, 60, true)], NOW_12)).toBeNull();
    expect(computeFocusHours([], NOW_12)).toBeNull();
  });

  it('returns null without a clear gap', () => {
    const rate = 2;
    const almost = rate * FOCUS_HOURS_MIN_GAP_RATIO - 0.1;
    expect(computeFocusHours([bucket(9, rate), bucket(10, rate), bucket(11, almost)], NOW_12)).toBeNull();
    expect(computeFocusHours([bucket(9, 0), bucket(10, 0), bucket(11, 0)], NOW_12)).toBeNull();
  });
});
