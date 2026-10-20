import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../types/models';
import { getDateStatus, getDeadlineMs, getRemainingTimeLabel } from './taskDateStatus';

// Os dicionarios carregam a pedido; aqui so interessam os numeros.
const EN_TIME: Record<string, string> = {
  'time.left': '{amount} left',
  'time.overdue': '{amount} overdue',
  'time.daysHours': '{days}d {hours}h',
  'time.days': '{days}d',
  'time.hours': '{hours}h',
  'time.underHour': '<1h',
};
vi.mock('../i18n/translate', () => ({
  translateNow: (key: string, vars: Record<string, string | number> = {}) =>
    (EN_TIME[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name])),
}));

const task = (date: string, progressStatus: Task['progressStatus'] = 'ON_TRACK') =>
  ({ date, progressStatus }) as Task;

describe('taskDateStatus', () => {
  it('treats a date-only deadline as the end of that day', () => {
    expect(getDeadlineMs(task('2026-10-21T00:00:00.000Z'))).toBe(Date.parse('2026-10-22T00:00:00.000Z'));
  });

  it('keeps an exact time when the task has one', () => {
    expect(getDeadlineMs(task('2026-10-21T14:30:00.000Z'))).toBe(Date.parse('2026-10-21T14:30:00.000Z'));
  });

  it('shows a test tomorrow as more than a day away late in the evening', () => {
    const now = new Date('2026-10-20T22:09:00.000Z');
    expect(getRemainingTimeLabel(task('2026-10-21T00:00:00.000Z'), now)).toBe('1d 1h left');
  });

  it('does not call a task due today overdue while the day is not over', () => {
    const now = new Date('2026-10-20T10:00:00.000Z');
    const dueToday = task('2026-10-20T00:00:00.000Z');
    expect(getDateStatus(dueToday, now)).toBe('today');
    expect(getRemainingTimeLabel(dueToday, now)).toBe('14h left');
  });

  it('counts overdue time from the end of the due day', () => {
    const now = new Date('2026-10-22T03:00:00.000Z');
    expect(getRemainingTimeLabel(task('2026-10-20T00:00:00.000Z'), now)).toBe('1d 3h overdue');
  });
});
