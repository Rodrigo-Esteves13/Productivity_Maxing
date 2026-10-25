import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lisbonTodayKey, taskDayKey, todayKey, toDateKey } from './dateKey';
import { tomorrowForTask } from './weekDates';

describe('dateKey helpers', () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'Europe/Lisbon';
  });
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('lisbonTodayKey is the Lisbon calendar day whatever the browser zone is', () => {
    process.env.TZ = 'Asia/Tokyo';
    // 00:30 on 16 July in Lisbon (UTC+1) = 08:30 in Tokyo on 16 July.
    expect(lisbonTodayKey(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
    // 23:30 on 15 July in Lisbon = 07:30 on 16 July in Tokyo: still 15 in Lisbon.
    expect(lisbonTodayKey(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-15');
  });

  it('todayKey is the browser-local day (not UTC)', () => {
    expect(todayKey(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15');
    expect(toDateKey(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-14');
  });

  it('taskDayKey uses the stored day for date-only tasks and the local day for timed ones', () => {
    expect(taskDayKey(new Date('2026-07-15T00:00:00Z'))).toBe('2026-07-15');
    expect(taskDayKey(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15');
  });
});

describe('tomorrowForTask (B-09)', () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'Europe/Lisbon';
  });
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('keeps a date-only task date-only (UTC midnight of tomorrow)', () => {
    const now = new Date('2026-07-15T10:00:00Z'); // 11:00 Lisbon, 15 July
    const result = tomorrowForTask(new Date('2026-07-10T00:00:00Z'), now);
    expect(result.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  it('uses the local day for "tomorrow" around Lisbon midnight', () => {
    const now = new Date('2026-07-14T23:30:00Z'); // 00:30 Lisbon, 15 July
    const result = tomorrowForTask(new Date('2026-07-10T00:00:00Z'), now);
    expect(result.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  it('keeps the local time of a timed task', () => {
    const now = new Date('2026-07-15T10:00:00Z');
    const timed = new Date('2026-07-12T13:45:00Z'); // 14:45 Lisbon
    const result = tomorrowForTask(timed, now);
    expect(result.toISOString()).toBe('2026-07-16T13:45:00.000Z');
  });
});
