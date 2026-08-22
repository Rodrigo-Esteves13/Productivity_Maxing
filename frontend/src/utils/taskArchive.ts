import type { Task } from '../types/models';

// 30 days: long enough that a task you finished last week (still worth
// glancing at, might still be relevant to the current sprint of work)
// stays visible, short enough that a semester's worth of completed tasks
// doesn't pile up in the main list by the time exams roll around.
export const ARCHIVE_AFTER_DAYS = 30;

/**
 * A task is "archived" purely as a computed, display-only concept - a
 * completed task whose completedAt is older than ARCHIVE_AFTER_DAYS.
 * Deliberately NOT a stored isArchived column: AcademicPeriod already has
 * one (a real, user-toggled state - restorePeriod() flips it back), but a
 * Task's archived-ness here is just a function of data that's already on
 * the row (progressStatus + completedAt), so a stored flag would just be
 * a second source of truth to keep in sync with itself. Recomputing it
 * from what's already there needs no migration and can never drift.
 */
export function isTaskArchived(task: Task, now: Date = new Date()): boolean {
  if (task.progressStatus !== 'COMPLETED' || !task.completedAt) return false;
  const completedAt = new Date(task.completedAt);
  const daysSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCompletion >= ARCHIVE_AFTER_DAYS;
}
