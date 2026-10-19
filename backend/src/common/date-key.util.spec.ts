import { lisbonDayBounds, toLisbonDateKey } from './date-key.util';

describe('Lisbon day helpers', () => {
  it('puts 00:30 Lisbon summer time on the Lisbon day, not the UTC day', () => {
    // 2026-07-15 00:30 WEST = 2026-07-14 23:30 UTC
    expect(toLisbonDateKey(new Date('2026-07-14T23:30:00.000Z'))).toBe(
      '2026-07-15',
    );
  });

  it('matches the UTC day in winter (Lisbon = UTC)', () => {
    expect(toLisbonDateKey(new Date('2026-01-15T23:30:00.000Z'))).toBe(
      '2026-01-15',
    );
  });

  it('gives summer day bounds one hour before UTC midnight', () => {
    const { start, end } = lisbonDayBounds('2026-07-15');
    expect(start.toISOString()).toBe('2026-07-14T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-15T23:00:00.000Z');
  });

  it('includes a date-only task (stored at UTC midnight) in its own day', () => {
    const { start, end } = lisbonDayBounds('2026-07-15');
    const dateOnly = new Date('2026-07-15T00:00:00.000Z');
    expect(dateOnly >= start && dateOnly < end).toBe(true);
  });

  it('handles the DST change day (23 hours long)', () => {
    // 2026-03-29: clocks go forward at 01:00 UTC in Lisbon
    const { start, end } = lisbonDayBounds('2026-03-29');
    expect(start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-29T23:00:00.000Z');
  });
});
