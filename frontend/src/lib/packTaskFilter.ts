import { filterByQuery } from './listFilter';

export const ALL_AREAS = 'all';

interface FilterableTask {
  title: string;
  areaId: string;
}

/** Tarefas que batem na pesquisa (titulo ou nome da Area) e na Area escolhida. */
export function filterPackTasks<T extends FilterableTask>(
  tasks: readonly T[],
  query: string,
  areaId: string,
  areaName: (task: T) => string | undefined,
): T[] {
  const inArea = areaId === ALL_AREAS ? tasks.slice() : tasks.filter((task) => task.areaId === areaId);
  return filterByQuery(inArea, query, (task) => [task.title, areaName(task)]);
}
