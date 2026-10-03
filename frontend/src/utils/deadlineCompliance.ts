import type { Task } from '../types/models';
import { toLocalDayKey } from './profileStats';
import { MS_PER_DAY } from '../lib/timeConstants';


export interface MonthCompliance {
  monthKey: string; // "YYYY-MM", local time
  label: string; // "Sep"
  onTime: number;
  late: number;
  total: number;
  ratePct: number | null; // null when total is 0
}

export interface DeadlineCompliance {
  months: MonthCompliance[];
  onTime: number;
  late: number;
  total: number;
  ratePct: number | null;
}

// A task with no time set is stored as UTC midnight of its due day (see
// buildTaskDate in utils/taskPayload.ts), which would make finishing it
// during the due day itself count as "late". For those, the real deadline
// is the end of that day. Tasks with an explicit time keep it as-is.
function effectiveDeadlineMs(task: Task): number {
  const deadline = new Date(task.date);
  const isDateOnly =
    deadline.getUTCHours() === 0 &&
    deadline.getUTCMinutes() === 0 &&
    deadline.getUTCSeconds() === 0;
  return deadline.getTime() + (isDateOnly ? MS_PER_DAY : 0);
}

// Shared by DeadlineComplianceCard and ProductivityByTypeCard so both
// agree on what "on time" means. Returns null (not false) when the task
// has no completedAt, so callers can exclude it instead of counting it
// as late.
export function wasCompletedOnTime(task: Task): boolean | null {
  if (task.progressStatus !== 'COMPLETED' || !task.completedAt) return null;
  return new Date(task.completedAt).getTime() <= effectiveDeadlineMs(task);
}

function monthKeyOf(date: Date): string {
  return toLocalDayKey(date).slice(0, 7);
}

// Only tasks with a real completedAt count. Tasks completed before that
// column existed have none, and using their deadline as a stand-in would
// mark every one of them "on time" and inflate the rate.
export function computeDeadlineCompliance(
  tasks: Task[],
  monthsBack = 6,
  now: Date = new Date(),
): DeadlineCompliance {
  const buckets = new Map<string, MonthCompliance>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKeyOf(d), {
      monthKey: monthKeyOf(d),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      onTime: 0,
      late: 0,
      total: 0,
      ratePct: null,
    });
  }

  for (const task of tasks) {
    const onTime = wasCompletedOnTime(task);
    if (onTime === null || !task.completedAt) continue;
    const bucket = buckets.get(monthKeyOf(new Date(task.completedAt)));
    if (!bucket) continue;
    if (onTime) bucket.onTime += 1;
    else bucket.late += 1;
    bucket.total += 1;
  }

  const months = Array.from(buckets.values()).map((m) => ({
    ...m,
    ratePct: m.total > 0 ? Math.round((m.onTime / m.total) * 100) : null,
  }));
  const onTime = months.reduce((s, m) => s + m.onTime, 0);
  const late = months.reduce((s, m) => s + m.late, 0);
  const total = onTime + late;

  return { months, onTime, late, total, ratePct: total > 0 ? Math.round((onTime / total) * 100) : null };
}
