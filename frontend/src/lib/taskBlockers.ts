import type { Task } from '../types/models';

export interface BlockerOption {
  id: string;
  title: string;
}

/** Tasks que podem ser escolhidas como bloqueador: abertas e sem a propria task. */
export function openBlockerOptions(tasks: readonly Task[], excludeId?: string): BlockerOption[] {
  return tasks
    .filter((task) => task.id !== excludeId && task.progressStatus !== 'COMPLETED')
    .map((task) => ({ id: task.id, title: task.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
