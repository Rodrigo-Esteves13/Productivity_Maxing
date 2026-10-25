import { describe, expect, it } from 'vitest';
import { suggestStudyWindow, toLisbonWeekdayHour } from './studyWindow';
import type { HeatmapCell } from '../types/models';

describe('toLisbonWeekdayHour', () => {
  it('uses Lisbon time, not UTC (summer, UTC+1)', () => {
    // Saturday 2026-07-04 23:30 UTC = Sunday 00:30 Lisbon.
    expect(toLisbonWeekdayHour(new Date('2026-07-04T23:30:00.000Z'))).toEqual({ dayOfWeek: 0, hour: 0 });
    // 19:30 UTC = 20:30 Lisbon.
    expect(toLisbonWeekdayHour(new Date('2026-07-04T19:30:00.000Z'))).toEqual({ dayOfWeek: 6, hour: 20 });
  });
});

describe('suggestStudyWindow', () => {
  it('matches "now" against the Lisbon bucket the backend groups by', () => {
    const cells: HeatmapCell[] = [{ dayOfWeek: 6, hourBucket: 5, totalMinutes: 600, sessionCount: 10 }];
    // 19:30 UTC is bucket 4 in UTC but bucket 5 (20-24) in Lisbon.
    expect(suggestStudyWindow(cells, new Date('2026-07-04T19:30:00.000Z'))).toEqual({ kind: 'now', sessionCount: 10 });
  });
});
