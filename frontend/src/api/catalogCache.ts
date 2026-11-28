import { notifyDomainChanged } from '../lib/domainEvents';
import {
  forgetLastKnown,
  patchLastKnown,
  peekLastKnown,
  subscribeToRevalidated,
  type QueryOptions,
} from './queryCache';
import type { Area, Task, TaskMeta } from '../types/models';

// Politica de cache das listas pedidas em todo o lado (F-16): tasks por
// periodo, areas e o catalogo de metadados. Qualquer escrita nao neutra
// limpa tudo (mutationInvalidation.ts), logo o TTL so cobre mudancas feitas
// fora desta tab e fora de outra tab do mesmo browser (agente, turma, admin).

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

// Tasks: mudam muito. Fresco 10 s, depois mostra a copia e revalida ate 1 min.
export const TASKS_FRESH_MS = 10 * SECOND_MS;
export const TASKS_STALE_MS = MINUTE_MS;
// Areas: mudam pouco (admin, propostas). Fresco 1 min, revalida ate 10 min.
export const AREAS_FRESH_MS = MINUTE_MS;
export const AREAS_STALE_MS = 10 * MINUTE_MS;
// Metadados (tipos, prioridades, estados): catalogo do admin, quase estatico.
export const META_FRESH_MS = 5 * MINUTE_MS;
export const META_STALE_MS = 30 * MINUTE_MS;
// Idade maxima do "ultimo conhecido" das tasks para contar conquistas.
export const KNOWN_TASKS_MAX_AGE_MS = 10 * MINUTE_MS;

const COMPLETED: Task['progressStatus'] = 'COMPLETED';

// Copia rasa por item: protege o array e os campos de topo. Os chamadores
// nao mutam arrays aninhados (subtasks, tags), so os substituem.
export const cloneTasks = (tasks: Task[]): Task[] => tasks.map((task) => ({ ...task }));
const cloneAreas = (areas: Area[]): Area[] => areas.map((area) => ({ ...area }));
const cloneMeta = (meta: TaskMeta): TaskMeta => structuredClone(meta);

const DEFAULT_PERIOD = '';

export const tasksKey = (periodId?: string): string => `tasks|${periodId ?? DEFAULT_PERIOD}`;
// Lista do periodo ativo do servidor (sem periodId): a que as conquistas usam.
export const DEFAULT_TASKS_KEY = tasksKey();
export const areasKey = (periodId: string | undefined, includeHidden: boolean): string =>
  `areas|${periodId ?? ''}|${includeHidden ? 'hidden' : 'visible'}`;
export const META_KEY = 'tasks-meta';

export function tasksQuery(periodId?: string): QueryOptions<Task[]> {
  return {
    freshMs: TASKS_FRESH_MS,
    staleMs: TASKS_STALE_MS,
    clone: cloneTasks,
    keepLastKnown: periodId === undefined,
    // Outra pessoa/dispositivo mudou as tasks: os cartoes voltam a ler.
    onRevalidated: () => notifyDomainChanged('tasks'),
  };
}

export const AREAS_QUERY: QueryOptions<Area[]> = {
  freshMs: AREAS_FRESH_MS,
  staleMs: AREAS_STALE_MS,
  clone: cloneAreas,
};

export const META_QUERY: QueryOptions<TaskMeta> = {
  freshMs: META_FRESH_MS,
  staleMs: META_STALE_MS,
  clone: cloneMeta,
};

// Lista nova de um periodo cuja copia velha foi servida (revalidacao em fundo).
export function subscribeToRevalidatedTasks(
  periodId: string | undefined,
  listener: (tasks: Task[]) => void,
): () => void {
  return subscribeToRevalidated<Task[]>(tasksKey(periodId), listener);
}

// "Ultimo conhecido" das tasks do periodo ativo, corrigido pelas escritas
// que o proprio servico sabe aplicar (F-18). undefined = ir a rede.
export function peekKnownTasks(): Task[] | undefined {
  return peekLastKnown<Task[]>(DEFAULT_TASKS_KEY, KNOWN_TASKS_MAX_AGE_MS, cloneTasks);
}

// Substitui (ou junta) tasks devolvidas pelo backend.
export function rememberTasks(tasks: Task[]): void {
  if (tasks.length === 0) return;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  patchLastKnown<Task[]>(DEFAULT_TASKS_KEY, (list) => {
    const known = new Set(list.map((task) => task.id));
    return [
      ...list.map((task) => byId.get(task.id) ?? task),
      ...tasks.filter((task) => !known.has(task.id)),
    ];
  });
}

export function forgetTasks(ids: readonly string[]): void {
  const gone = new Set(ids);
  patchLastKnown<Task[]>(DEFAULT_TASKS_KEY, (list) => list.filter((task) => !gone.has(task.id)));
}

// Mesmo efeito que o backend em bulk-status: completedAt agora ao concluir,
// limpo ao sair de COMPLETED.
export function rememberStatus(ids: readonly string[], status: Task['progressStatus'], at: string): void {
  const changed = new Set(ids);
  patchLastKnown<Task[]>(DEFAULT_TASKS_KEY, (list) =>
    list.map((task) => {
      if (!changed.has(task.id) || task.progressStatus === status) return task;
      return { ...task, progressStatus: status, completedAt: status === COMPLETED ? at : null };
    }),
  );
}

// Escrita que pode tirar ou por tasks no periodo ativo sem o sabermos.
export function forgetKnownTasks(): void {
  forgetLastKnown(DEFAULT_TASKS_KEY);
}
