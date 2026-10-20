import { describe, expect, it } from 'vitest';
import { addUtcMonths, monthGridDays, startOfMonth } from './monthGrid';

const utc = (key: string) => new Date(`${key}T00:00:00Z`);

describe('monthGridDays', () => {
  it('starts on the Monday before day 1 and ends on the Sunday after the last day', () => {
    // Outubro 2026 comeca numa quinta e acaba num sabado.
    const days = monthGridDays(utc('2026-10-01'));
    expect(days[0].key).toBe('2026-09-28');
    expect(days[days.length - 1].key).toBe('2026-11-01');
    expect(days).toHaveLength(35);
  });

  it('marks only the days of the month as inMonth', () => {
    const days = monthGridDays(utc('2026-10-01'));
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
    expect(days[0].inMonth).toBe(false);
    expect(days[3].key).toBe('2026-10-01');
    expect(days[3].inMonth).toBe(true);
  });

  it('gives 6 weeks when day 1 is a Sunday and 4 when February starts on a Monday', () => {
    expect(monthGridDays(utc('2026-11-01'))).toHaveLength(42);
    const february = monthGridDays(utc('2027-02-01'));
    expect(february).toHaveLength(28);
    expect(february[0].key).toBe('2027-02-01');
  });
});

describe('startOfMonth / addUtcMonths', () => {
  it('moves across year boundaries in UTC', () => {
    expect(startOfMonth(utc('2026-10-31')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(addUtcMonths(utc('2026-12-01'), 1).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(addUtcMonths(utc('2026-01-01'), -1).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });
});
