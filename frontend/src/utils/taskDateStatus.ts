import type { Task } from '../types/models';
import { MS_PER_HOUR, MS_PER_DAY } from '../lib/timeConstants';
import { toDateKey } from '../lib/dateKey';

export type DateStatus = 'completed' | 'overdue' | 'today' | 'upcoming';

// Classifies the task by date + progressStatus:
// - already completed (COMPLETED) always wins that classification, even if
//   the reference date has already passed or is still upcoming;
// - otherwise, compares the task's `date` to today.
export function getDateStatus(task: Task, now: Date = new Date()): DateStatus {
  if (task.progressStatus === 'COMPLETED') return 'completed';

  const taskDate = new Date(task.date);
  const todayKey = toDateKey(now);
  const taskKey = toDateKey(taskDate);

  if (taskKey === todayKey) return 'today';
  return taskDate.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}


// Short text for the time remaining (or already elapsed) until the due
// date, to complement DateStatusBadge (which only says "Overdue"/"Upcoming",
// without quantifying how much). Completed tasks don't show a count -
// "how much is left" no longer matters for something that's done.
export function getRemainingTimeLabel(task: Task, now: Date = new Date()): string {
  if (task.progressStatus === 'COMPLETED') return 'N/A';

  const diffMs = new Date(task.date).getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  const days = Math.floor(absMs / MS_PER_DAY);
  const hours = Math.floor((absMs % MS_PER_DAY) / MS_PER_HOUR);

  let amount: string;
  if (days >= 1) {
    amount = `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
  } else if (hours >= 1) {
    amount = `${hours}h`;
  } else {
    amount = '<1h';
  }

  return diffMs < 0 ? `${amount} overdue` : `${amount} left`;
}
