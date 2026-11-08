import {
  addUtcDays,
  diffUtcDays,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';

// Streak freeze rules: earn 1 freeze every FREEZE_EARN_INTERVAL_DAYS of
// consecutive study, banked up to FREEZE_MAX_BANKED at once. A banked
// freeze auto-covers exactly one missed day in the past (streak doesn't
// grow that day, but doesn't reset either) - the whole point is a single
// off day doesn't wipe out weeks of consistency. Deliberately NOT
// unlimited/easy to earn: if freezes were cheap the streak would stop
// meaning anything.
export const FREEZE_EARN_INTERVAL_DAYS = 7;
export const FREEZE_MAX_BANKED = 2;

export interface StreakWalk {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  freezesUsedTotal: number;
}

/**
 * Walks day by day from `firstDayKey` to `todayKey` over the set of Lisbon
 * day keys with activity. Pure: shared by the streak endpoint and the
 * streak-at-risk reminder so both always agree.
 *
 * Today is never treated as a "miss" even with zero activity so far - the
 * day isn't over yet.
 */
export function walkStreak(
  activeDays: ReadonlySet<string>,
  firstDayKey: string,
  todayKey: string,
): StreakWalk {
  const firstDay = parseDateKey(firstDayKey);
  const totalDays = diffUtcDays(firstDay, parseDateKey(todayKey)) + 1;

  let currentStreak = 0;
  let longestStreak = 0;
  let freezesAvailable = 0;
  let freezesUsedTotal = 0;

  for (let i = 0; i < totalDays; i++) {
    const dayKey = toDateKey(addUtcDays(firstDay, i));
    const isToday = dayKey === todayKey;

    if (activeDays.has(dayKey)) {
      currentStreak += 1;
      if (currentStreak % FREEZE_EARN_INTERVAL_DAYS === 0) {
        freezesAvailable = Math.min(freezesAvailable + 1, FREEZE_MAX_BANKED);
      }
    } else if (isToday) {
      // Not over yet - leave currentStreak as-is, don't spend a freeze,
      // don't reset.
    } else if (freezesAvailable > 0) {
      freezesAvailable -= 1;
      freezesUsedTotal += 1;
      // Streak survives the gap, but a frozen day doesn't itself extend
      // the streak - only real study days do.
    } else {
      currentStreak = 0;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return { currentStreak, longestStreak, freezesAvailable, freezesUsedTotal };
}
