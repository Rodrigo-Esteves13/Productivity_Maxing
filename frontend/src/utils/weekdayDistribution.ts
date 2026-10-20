import type { Task } from '../types/models';
import { weekdayLabel } from '../lib/timeFormat';

// Monday-first, matching how the rest of the app's week views read. Values
// are JS getDay() numbers (0 = Sunday).
const WEEKDAYS_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export interface WeekdayBucket {
  // Short weekday name in the app language ("Mon", "周一", "seg.").
  label: string;
  pending: number;
  completed: number;
  total: number;
}

// Local weekday of the due date. Date-only tasks are stored as UTC
// midnight (see buildTaskDate in taskPayload.ts), so in a timezone behind
// UTC the local weekday would land on the day BEFORE the one the user
// picked. Those are read in UTC instead; tasks with an explicit time are
// read in local time, which is what the user sees on screen.
function dueWeekdayIndexMondayFirst(task: Task): number {
  const d = new Date(task.date);
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const sundayFirst = isDateOnly ? d.getUTCDay() : d.getDay();
  return (sundayFirst + 6) % 7;
}

export function computeWeekdayDistribution(tasks: Task[], locale?: string): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = WEEKDAYS_MONDAY_FIRST.map((dayOfWeek) => ({
    label: weekdayLabel(dayOfWeek, locale),
    pending: 0,
    completed: 0,
    total: 0,
  }));
  for (const task of tasks) {
    const bucket = buckets[dueWeekdayIndexMondayFirst(task)];
    if (task.progressStatus === 'COMPLETED') bucket.completed += 1;
    else bucket.pending += 1;
    bucket.total += 1;
  }
  return buckets;
}
