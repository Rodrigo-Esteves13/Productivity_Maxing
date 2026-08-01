import type { Task } from '../types/models';
import { getDateStatus } from './taskDateStatus';

export interface OverloadWindow {
  // Inclusive rolling window, today through today+6 days (7 days total) -
  // matches how "this week" reads in everyday use ("the next 7 days"),
  // rather than snapping to a Mon-Sun calendar week that could hide a
  // pile-up split across two calendar weeks.
  tasks: Task[];
}

// A week is "heavy" once it has this many pending (non-completed) tasks
// due within it - deliberately a flat count rather than weighted by
// difficulty/weight: the point is raw volume ("how many things need
// attention"), which is what actually causes the feeling of being
// overloaded, independent of how much each one is worth.
const OVERLOAD_THRESHOLD = 5;

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function toMidnightUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Looks at every pending task due in the next 7 days (today inclusive)
 * and flags the window when it's unusually loaded. Mirrors
 * detectDeadlineOverlaps.ts: a pure frontend calculation over tasks the
 * Dashboard already has loaded, no new endpoint.
 */
export function detectOverloadWeek(tasks: Task[], now: Date = new Date()): OverloadWindow | null {
  const todayMidnight = toMidnightUtc(now);

  const windowTasks = tasks.filter((task) => {
    const status = getDateStatus(task, now);
    if (status !== 'today' && status !== 'upcoming') return false;
    const daysAway = (toMidnightUtc(new Date(task.date)) - todayMidnight) / DAY_MS;
    return daysAway < WINDOW_DAYS;
  });

  if (windowTasks.length < OVERLOAD_THRESHOLD) return null;

  return {
    tasks: [...windowTasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  };
}
