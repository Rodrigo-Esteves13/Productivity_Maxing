import type { Task } from '../types/models';
import { dueWeekdayIndexMondayFirst } from '../utils/weekdayDistribution';
import { hasFirmDate } from './taskReadiness';

// Below this many postponements the card stays hidden.
export const MIN_POSTPONEMENTS = 5;
// Below this many it shows, but flagged as an early signal.
export const EARLY_SIGNAL_POSTPONEMENTS = 15;

export interface ProcrastinationWeekdays {
  // Postponements per weekday, Monday first (index 0 = Monday).
  counts: number[];
  total: number;
  // Weekday indexes (Monday = 0) sharing the highest count. Empty when there
  // is no variation to report.
  peaks: number[];
  hasEnoughData: boolean;
  isEarlySignal: boolean;
  noVariation: boolean;
}

// No per-postponement history exists, only Task.postponedCount. Honest
// approximation: group tasks that were postponed at least once by the
// weekday of their CURRENT due date, weighted by postponedCount. Tasks
// without a firm date (UNKNOWN / SURPRISE) are ignored.
export function computeProcrastinationWeekdays(tasks: Task[]): ProcrastinationWeekdays {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const task of tasks) {
    const n = task.postponedCount ?? 0;
    if (n < 1 || !hasFirmDate(task)) continue;
    counts[dueWeekdayIndexMondayFirst(task)] += n;
  }
  const total = counts.reduce((s, c) => s + c, 0);
  const hasEnoughData = total >= MIN_POSTPONEMENTS;
  const max = Math.max(...counts);
  const flat = counts.every((c) => c === counts[0]);
  const peaks = hasEnoughData && !flat ? counts.flatMap((c, i) => (c === max ? [i] : [])) : [];
  return {
    counts,
    total,
    peaks,
    hasEnoughData,
    isEarlySignal: hasEnoughData && total < EARLY_SIGNAL_POSTPONEMENTS,
    noVariation: hasEnoughData && flat,
  };
}
