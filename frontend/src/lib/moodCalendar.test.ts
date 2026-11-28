import { describe, expect, it } from 'vitest';
import { dayKeyBefore, moodCalendarDays } from './moodCalendar';

describe('moodCalendarDays', () => {
  it('lists the last days ending today, across a month boundary', () => {
    const days = moodCalendarDays('2026-03-02', { '2026-02-28': 4, '2026-03-02': 1 }, 4);
    expect(days.map((d) => d.key)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(days.map((d) => d.offset)).toEqual([3, 2, 1, 0]);
    expect(days.map((d) => d.mood)).toEqual([null, 4, null, 1]);
  });

  it('covers 30 days by default', () => {
    const days = moodCalendarDays('2026-11-24', {});
    expect(days).toHaveLength(30);
    expect(days[0].key).toBe(dayKeyBefore('2026-11-24', 29));
  });
});
