import type { Task } from '../types/models';

// Mirror of backend/src/tasks/task-tags.ts limits.
export const TAGS_MAX = 10;
export const TAG_LEN_MAX = 24;

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, TAG_LEN_MAX).trim();
}

/** Distinct tags across tasks, sorted. */
export function collectTags(tasks: Task[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags ?? []))].sort();
}
