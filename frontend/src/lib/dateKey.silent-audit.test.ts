import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toDateKey, todayKey } from './dateKey';
import { todayUtcAnchored } from './weekDates';
import { getDateStatus } from '../utils/taskDateStatus';
import type { Task } from '../types/models';

// Silent-bug audit (area f): the frontend has two notions of "today".
// todayKey() is the UTC calendar day; todayUtcAnchored() is the browser's
// local calendar day; the backend uses the Lisbon calendar day. Between
// 00:00 and 01:00 in Lisbon (summer, UTC+1) and for any user west of UTC
// in the evening, they disagree.

// 00:30 on 15 July 2026 in Lisbon (WEST, UTC+1) = 23:30 UTC on 14 July.
const LISBON_0030_JUL15 = new Date('2026-07-14T23:30:00.000Z');

describe('date keys: one rule for "today" (F-09)', () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'Europe/Lisbon';
    vi.useFakeTimers();
    vi.setSystemTime(LISBON_0030_JUL15);
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('todayKey() and todayUtcAnchored() agree on what "today" is', () => {
    // Local (Lisbon) day is 2026-07-15.
    expect(toDateKey(todayUtcAnchored())).toBe('2026-07-15');
    // todayKey() (used as default date in TaskForm, ShiftForm, BulkActionsBar
    // "Today", StudyActivityCard goal, useOverdueCheckins gate...) returns 2026-07-14.
    expect(todayKey()).toBe(toDateKey(todayUtcAnchored()));
  });

  it('a task due today (date-only, stored at UTC midnight) is classified as "today"', () => {
    const task = { progressStatus: 'NOT_STARTED', date: '2026-07-15T00:00:00.000Z' } as unknown as Task;
    expect(getDateStatus(task, LISBON_0030_JUL15)).toBe('today');
  });

  it('a task due yesterday is "overdue", not "today"', () => {
    const task = { progressStatus: 'NOT_STARTED', date: '2026-07-14T00:00:00.000Z' } as unknown as Task;
    expect(getDateStatus(task, LISBON_0030_JUL15)).toBe('overdue');
  });

  it('a user in UTC-3 at 22:30 sees a task due today as "today", not "overdue"', () => {
    // 22:30 on 23 Oct in Sao Paulo (UTC-3) = 01:30 UTC on 24 Oct.
    // The browser runs in Sao Paulo here (the suite default is Lisbon, where
    // 02:30 on 24 Oct really makes a task due on the 23rd overdue).
    process.env.TZ = 'America/Sao_Paulo';
    const now = new Date('2026-10-24T01:30:00.000Z');
    const task = { progressStatus: 'NOT_STARTED', date: '2026-10-23T00:00:00.000Z' } as unknown as Task;
    expect(getDateStatus(task, now)).toBe('today');
  });
});
