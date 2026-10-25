import type { GradeAggregation, GradeComponent, Task } from '../types/models';

// Modo plano do Dashboard ("se tudo correr como planeado"). Mesmas regras do
// backend (academic-programs/grade-scenario.ts), aplicadas as tasks e aos
// componentes que alimentam os cartoes:
// - avaliacao com peso e sem nota: fica com a nota-alvo; sem alvo, com a
//   mediana das tuas notas nessa cadeira; sem nenhuma, com a do periodo;
// - componentes: as entradas que faltam valem essa mesma mediana.
// Nunca e gravado nada: so muda o que os cartoes mostram.

export function median(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

// Igual a computeComponentGrade (backend/grade-component.util.ts).
const AGGREGATORS: Record<GradeAggregation, (sortedDesc: number[], bestOf: number | null) => number> = {
  AVERAGE: (sorted) => mean(sorted),
  BEST_OF: (sorted, bestOf) =>
    mean(sorted.slice(0, bestOf && bestOf > 0 ? Math.min(bestOf, sorted.length) : sorted.length)),
  DROP_LOWEST: (sorted) => mean(sorted.length > 1 ? sorted.slice(0, -1) : sorted),
};

function componentGrade(grades: number[], aggregation: GradeAggregation, bestOf: number | null): number | null {
  if (grades.length === 0) return null;
  return round2(AGGREGATORS[aggregation]([...grades].sort((a, b) => b - a), bestOf));
}

const key = (areaId: string, periodId: string | null | undefined) => `${areaId}|${periodId ?? ''}`;

export type PlanFill = (areaId: string, periodId: string | null | undefined) => number | null;

/** Mediana usada para preencher: a da cadeira no periodo, senao a do periodo. */
export function buildPlanFill(tasks: Task[], components: GradeComponent[]): PlanFill {
  const byArea = new Map<string, number[]>();
  const byPeriod = new Map<string, number[]>();
  const remember = (areaId: string, periodId: string | null | undefined, grade: number) => {
    const a = key(areaId, periodId);
    byArea.set(a, [...(byArea.get(a) ?? []), grade]);
    const p = periodId ?? '';
    byPeriod.set(p, [...(byPeriod.get(p) ?? []), grade]);
  };
  for (const t of tasks) if (t.realGrade !== null) remember(t.areaId, t.periodId, t.realGrade);
  for (const c of components) for (const e of c.entries) remember(c.areaId, c.periodId, e.grade);
  return (areaId, periodId) =>
    median(byArea.get(key(areaId, periodId)) ?? []) ?? median(byPeriod.get(periodId ?? '') ?? []);
}

export function applyPlanToTasks(tasks: Task[], fill: PlanFill): Task[] {
  return tasks.map((task) => {
    if (task.realGrade !== null || (task.weightPercentage ?? 0) <= 0) return task;
    const planned = task.targetGrade ?? fill(task.areaId, task.periodId);
    return planned === null ? task : { ...task, realGrade: planned };
  });
}

export function applyPlanToComponents(components: GradeComponent[], fill: PlanFill): GradeComponent[] {
  return components.map((component) => {
    const grades = component.entries.map((e) => e.grade);
    const missing =
      grades.length === 0
        ? Math.max(1, component.expectedEntries ?? 1)
        : Math.max(0, (component.expectedEntries ?? 0) - grades.length);
    const value = missing > 0 ? fill(component.areaId, component.periodId) : null;
    if (value === null) return component;
    const filled = [...grades, ...Array<number>(missing).fill(value)];
    return { ...component, grade: componentGrade(filled, component.aggregation, component.bestOfCount) };
  });
}
