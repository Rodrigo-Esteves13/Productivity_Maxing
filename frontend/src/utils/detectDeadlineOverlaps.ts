import type { Task } from '../types/models';
import { getDateStatus } from './taskDateStatus';

export interface DeadlineOverlapGroup {
  // YYYY-MM-DD, taken from the ISO date shared by every task in the group.
  dateKey: string;
  tasks: Task[];
}

function toDayKey(isoDate: string): string {
  return isoDate.split('T')[0] ?? isoDate;
}

/**
 * Groups tasks that (a) count toward a grade - have a weightPercentage set,
 * same signal the rest of the app already uses to mean "this is a real
 * evaluation, not a casual study task" (see computeWeightedAverage in the
 * backend's grade-average.util.ts) - and (b) are still due (today or in the
 * future, not completed), by calendar day. Only days with 2+ such tasks are
 * kept: that's an actual scheduling clash (two exams, or an exam and a
 * project deadline, on the same date), not the routine same-day overlap of
 * ungraded tasks (readings, reviews, etc), which would just be noise here.
 *
 * Sorted soonest-first; within a group, heaviest weight first (the task
 * most worth noticing first if you can only prep for one).
 */
export function detectDeadlineOverlaps(tasks: Task[]): DeadlineOverlapGroup[] {
  const candidates = tasks.filter((task) => {
    if (task.weightPercentage === null) return false;
    const status = getDateStatus(task);
    return status === 'today' || status === 'upcoming';
  });

  const byDay = new Map<string, Task[]>();
  for (const task of candidates) {
    const key = toDayKey(task.date);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(task);
    } else {
      byDay.set(key, [task]);
    }
  }

  return Array.from(byDay.entries())
    .filter(([, group]) => group.length >= 2)
    .map(([dateKey, group]) => ({
      dateKey,
      tasks: [...group].sort(
        (a, b) => (b.weightPercentage ?? 0) - (a.weightPercentage ?? 0),
      ),
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
}
