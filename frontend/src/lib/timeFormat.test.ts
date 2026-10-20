import { describe, expect, it } from 'vitest';
import { formatTaskDate } from './timeFormat';

describe('formatTaskDate', () => {
  it('shows a date-only task on its own day in any timezone', () => {
    // Num fuso a oeste de UTC (ex: America/Sao_Paulo) o antigo
    // toLocaleDateString() sem timeZone dava 10/20/2026.
    expect(formatTaskDate('2026-10-21T00:00:00.000Z', 'en-US')).toBe('10/21/2026');
  });

  it('uses the local timezone for a task with a time', () => {
    const value = '2026-10-21T14:30:00.000Z';
    expect(formatTaskDate(value, 'en-US')).toBe(new Date(value).toLocaleDateString('en-US'));
  });
});
