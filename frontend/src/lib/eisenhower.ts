import type { Task } from '../types/models';
import { hasFirmDate } from './taskReadiness';
import { taskDayKey, todayKey } from './dateKey';

// Matriz de Eisenhower: urgente (prazo em breve) x importante (prioridade alta
// ou muito peso na nota). Puro e sem rede.
export const URGENT_WITHIN_DAYS = 2;
export const IMPORTANT_WEIGHT_PCT = 15;
export const IMPORTANT_PRIORITY_KEYS: readonly string[] = ['HIGH'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const QUADRANTS = ['doFirst', 'schedule', 'quick', 'later'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

function dayNumber(key: string): number {
  return Math.floor(new Date(`${key}T00:00:00Z`).getTime() / MS_PER_DAY);
}

export function isUrgent(task: Task, now: Date = new Date()): boolean {
  if (!hasFirmDate(task)) return false;
  const left = dayNumber(taskDayKey(new Date(task.date))) - dayNumber(todayKey(now));
  return left <= URGENT_WITHIN_DAYS;
}

export function isImportant(task: Task): boolean {
  return (
    (task.priority != null && IMPORTANT_PRIORITY_KEYS.includes(task.priority)) ||
    (task.weightPercentage ?? 0) >= IMPORTANT_WEIGHT_PCT
  );
}

export function quadrantOf(task: Task, now: Date = new Date()): Quadrant {
  const urgent = isUrgent(task, now);
  const important = isImportant(task);
  if (urgent && important) return 'doFirst';
  if (important) return 'schedule';
  if (urgent) return 'quick';
  return 'later';
}

/** Tasks abertas e desbloqueadas por quadrante, cada lista pelo prazo. */
export function groupByQuadrant(tasks: readonly Task[], now: Date = new Date()): Record<Quadrant, Task[]> {
  const groups: Record<Quadrant, Task[]> = { doFirst: [], schedule: [], quick: [], later: [] };
  for (const task of tasks) {
    if (task.progressStatus === 'COMPLETED' || task.isBlocked) continue;
    groups[quadrantOf(task, now)].push(task);
  }
  for (const quadrant of QUADRANTS) groups[quadrant].sort((a, b) => a.date.localeCompare(b.date));
  return groups;
}
