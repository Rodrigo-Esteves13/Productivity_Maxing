// Mini-calendario do humor: os ultimos dias, do mais antigo para hoje.
import { toDateKey } from './dateKey';
import { MS_PER_DAY } from './timeConstants';

export const MOOD_CALENDAR_DAYS = 30;

export interface MoodCalendarDay {
  key: string; // YYYY-MM-DD
  // 0 = hoje, 1 = ontem...
  offset: number;
  mood: number | null;
}

export const dayKeyBefore = (today: string, offset: number): string =>
  toDateKey(new Date(Date.parse(today) - offset * MS_PER_DAY));

export function moodCalendarDays(
  today: string,
  moods: Record<string, number | null>,
  count: number = MOOD_CALENDAR_DAYS,
): MoodCalendarDay[] {
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const key = dayKeyBefore(today, offset);
    return { key, offset, mood: moods[key] ?? null };
  });
}
