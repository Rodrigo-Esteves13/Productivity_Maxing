import type { Task } from '../types/models';
import { getDateStatus } from '../utils/taskDateStatus';

// Filtros da pagina /tasks: Area e estado. Logica pura, sem rede.
export const TASK_STATE_FILTERS = ['all', 'pending', 'completed', 'overdue'] as const;
export type TaskStateFilter = (typeof TASK_STATE_FILTERS)[number];
export const ALL_AREAS = 'all';

const STATE_MATCHERS: Record<TaskStateFilter, (task: Task, now: Date) => boolean> = {
  all: () => true,
  pending: (task) => task.progressStatus !== 'COMPLETED',
  completed: (task) => task.progressStatus === 'COMPLETED',
  overdue: (task, now) => getDateStatus(task, now) === 'overdue',
};

export function isTaskStateFilter(value: string): value is TaskStateFilter {
  return (TASK_STATE_FILTERS as readonly string[]).includes(value);
}

/** Filtra por Area (id ou ALL_AREAS) e estado. */
export function filterTasksByAreaAndState(
  tasks: readonly Task[],
  areaId: string,
  state: TaskStateFilter,
  now: Date = new Date(),
): Task[] {
  const matchState = STATE_MATCHERS[state];
  return tasks.filter((task) => (areaId === ALL_AREAS || task.areaId === areaId) && matchState(task, now));
}

/** Texto pesquisavel de uma task. */
export function taskSearchFields(task: Task): Array<string | null | undefined> {
  return [task.title, task.topics, task.notes, task.area?.name, ...(task.tags ?? [])];
}
