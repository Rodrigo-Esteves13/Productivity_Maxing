import type { Task } from "../types/models";
import { hasFirmDate, isLocked } from "./taskReadiness";

// Valores dos filtros de esforco e de prontidao do Dashboard ('' = sem filtro).
export const EFFORT_FILTER_NONE = "NONE";

export const READINESS_FILTERS = ["ready", "locked", "dateTbd"] as const;
export type ReadinessFilter = (typeof READINESS_FILTERS)[number];

type ReadinessFields = Pick<
  Task,
  "effort" | "isBlocked" | "availableFrom" | "dateCertainty"
>;

// locked  = bloqueada a mao ou ainda nao abriu (availableFrom no futuro)
// dateTbd = data por marcar ou surpresa (so um palpite)
// ready   = da para comecar (nao bloqueada) e com prazo real
const READINESS_PREDICATES: Record<
  ReadinessFilter,
  (task: ReadinessFields, now: Date) => boolean
> = {
  ready: (task, now) => !isLocked(task, now) && hasFirmDate(task),
  locked: (task, now) => isLocked(task, now),
  dateTbd: (task) => !hasFirmDate(task),
};

/** Filtro por esforco: '' = todos, NONE = sem esforco definido, senao igual. */
export function matchesEffortFilter(
  task: Partial<Pick<Task, "effort">>,
  filter: string,
): boolean {
  if (!filter) return true;
  if (filter === EFFORT_FILTER_NONE) return !task.effort;
  return task.effort === filter;
}

/** Filtro por bloqueada / abre mais tarde / data por marcar. Valor desconhecido = sem filtro. */
export function matchesReadinessFilter(
  task: ReadinessFields,
  filter: string,
  now: Date = new Date(),
): boolean {
  if (!filter) return true;
  const predicate = READINESS_PREDICATES[filter as ReadinessFilter];
  return predicate ? predicate(task, now) : true;
}
