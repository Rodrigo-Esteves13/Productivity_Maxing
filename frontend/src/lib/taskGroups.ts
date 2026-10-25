import type { Task } from '../types/models';

export interface TaskAreaGroup {
  label: string;
  tasks: Task[];
}

/**
 * Tasks agrupadas pelo nome da cadeira (para <optgroup>), por ordem
 * alfabetica, com as tasks sem cadeira no fim. Dentro de cada grupo fica a
 * ordem recebida.
 */
export function groupTasksByArea(tasks: Task[], noAreaLabel: string): TaskAreaGroup[] {
  const byLabel = new Map<string, Task[]>();
  for (const task of tasks) {
    const label = task.area?.name ?? noAreaLabel;
    const list = byLabel.get(label);
    if (list) list.push(task);
    else byLabel.set(label, [task]);
  }
  return [...byLabel.keys()]
    .sort((a, b) => (a === noAreaLabel ? 1 : b === noAreaLabel ? -1 : a.localeCompare(b)))
    .map((label) => ({ label, tasks: byLabel.get(label) ?? [] }));
}
