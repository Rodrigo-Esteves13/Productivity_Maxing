import { computeComponentGrade } from '../grade-components/grade-component.util';
import type { GradeAggregationKind } from '../grade-components/grade-components.constants';

// Logica pura (sem BD) do cartao "If all goes according to plan": a nota
// final de cada cadeira se tirares a nota-alvo em tudo o que falta e
// cumprires o plano de estudo, ao lado da projecao atual.
//
// Regras (decididas na ideia N26 do backlog):
// - Task avaliada ja com nota: conta a nota real, nos dois cenarios.
// - Task avaliada por fazer: no plano conta a nota-alvo; sem alvo, a nota
//   projetada pelo tempo de estudo do plano; sem nenhuma, a mediana (abaixo).
//   Na projecao atual conta so a nota projetada (sem ela fica de fora).
// - Componentes de comportamento (presencas, participacao, mini-avaliacoes:
//   GradeComponent) nao tem alvo. No plano, as entradas que faltam (ou o
//   componente inteiro, sem entradas) valem a MEDIANA das tuas notas ja
//   lancadas nessa cadeira; sem nenhuma, a mediana das tuas notas nas outras
//   cadeiras do periodo; sem nada, ficam de fora e isso e dito. Mediana em
//   vez de media para uma nota muito boa ou muito ma nao puxar tudo.
// - Series recorrentes (o mesmo quiz semanal) contam o peso UMA vez, como em
//   computeWeightedAverage (grade-average.util.ts).

export interface ScenarioTask {
  areaId: string;
  title: string;
  weightPercentage: number;
  realGrade: number | null;
  targetGrade: number | null;
  // Nota projetada pelo GradeProjectionService (tempo de estudo do plano).
  projectedGrade: number | null;
  isRecurring: boolean;
}

export interface ScenarioComponent {
  areaId: string;
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregationKind;
  bestOfCount: number | null;
  expectedEntries: number | null;
  grades: number[];
}

export type FillSource = 'course_median' | 'period_median';

export interface ScenarioFill {
  // Nome do componente ou titulo da task que levou a mediana.
  label: string;
  kind: 'component' | 'task';
  weightPercentage: number;
  grade: number;
  source: FillSource;
}

export interface CourseScenario {
  areaId: string;
  // Media do que ja tem nota (null sem nada lancado).
  currentAverage: number | null;
  // Continuar como estas: notas reais + notas projetadas pelo estudo. null
  // quando alguma avaliacao por fazer nao tem projecao (sem dados que
  // cheguem): uma media so com parte das avaliacoes enganava.
  projectedFinal: number | null;
  // Tudo segundo o plano: reais + alvos + medianas.
  planFinal: number | null;
  // planFinal - projectedFinal (null se faltar um dos dois).
  delta: number | null;
  // Peso (em %) com nota no cenario do plano, e o que ficou sem valor.
  plannedWeight: number;
  missingWeight: number;
  fills: ScenarioFill[];
}

export function median(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1
    ? valid[mid]
    : (valid[mid - 1] + valid[mid]) / 2;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

interface WeightedItem {
  weight: number;
  grade: number | null;
}

function weightedAverage(items: WeightedItem[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const item of items) {
    if (item.grade === null) continue;
    sum += item.grade * item.weight;
    weight += item.weight;
  }
  return weight > 0 ? round2(sum / weight) : null;
}

const meanOrNull = (values: (number | null)[]): number | null => {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length > 0
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
};

interface TaskGroup {
  title: string;
  weight: number;
  real: (number | null)[];
  plan: (number | null)[];
  projected: (number | null)[];
  // Ha alguma ocorrencia por fazer sem alvo nem projecao (precisa da mediana).
  needsFill: boolean;
}

/** Junta as ocorrencias de cada serie recorrente num so item. */
function groupTasks(tasks: ScenarioTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  let single = 0;
  for (const task of tasks) {
    const key = task.isRecurring
      ? `series:${task.title}`
      : `single:${single++}`;
    const group = groups.get(key) ?? {
      title: task.title,
      weight: 0,
      real: [],
      plan: [],
      projected: [],
      needsFill: false,
    };
    group.weight = Math.max(group.weight, task.weightPercentage);
    if (task.realGrade !== null) {
      group.real.push(task.realGrade);
      group.plan.push(task.realGrade);
      group.projected.push(task.realGrade);
    } else {
      const planned = task.targetGrade ?? task.projectedGrade;
      group.plan.push(planned);
      group.projected.push(task.projectedGrade);
      if (planned === null) group.needsFill = true;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Cenario de uma cadeira. `periodMedian` e a mediana das notas de TODAS as
 * cadeiras do periodo (fallback quando esta ainda nao tem notas).
 */
export function buildCourseScenario(
  areaId: string,
  tasks: ScenarioTask[],
  components: ScenarioComponent[],
  periodMedian: number | null,
): CourseScenario {
  const knownGrades = [
    ...tasks.flatMap((t) => (t.realGrade !== null ? [t.realGrade] : [])),
    ...components.flatMap((c) => c.grades),
  ];
  const courseMedian = median(knownGrades);
  const fill =
    courseMedian !== null
      ? { grade: courseMedian, source: 'course_median' as const }
      : periodMedian !== null
        ? { grade: periodMedian, source: 'period_median' as const }
        : null;

  const current: WeightedItem[] = [];
  const projected: WeightedItem[] = [];
  const plan: WeightedItem[] = [];
  const fills: ScenarioFill[] = [];
  let missingWeight = 0;
  let projectionIncomplete = false;

  for (const group of groupTasks(tasks)) {
    current.push({ weight: group.weight, grade: meanOrNull(group.real) });
    if (group.projected.includes(null)) projectionIncomplete = true;
    projected.push({
      weight: group.weight,
      grade: meanOrNull(group.projected),
    });
    const planValues = group.plan.map((g) => g ?? fill?.grade ?? null);
    const planGrade = planValues.includes(null) ? null : meanOrNull(planValues);
    plan.push({ weight: group.weight, grade: planGrade });
    if (planGrade === null) missingWeight += group.weight;
    else if (group.needsFill && fill) {
      fills.push({
        label: group.title,
        kind: 'task',
        weightPercentage: group.weight,
        ...fill,
      });
    }
  }

  for (const component of components) {
    const known = computeComponentGrade(
      component.grades,
      component.aggregation,
      component.bestOfCount,
    );
    current.push({ weight: component.weightPercentage, grade: known });
    projected.push({ weight: component.weightPercentage, grade: known });

    const missingEntries =
      component.grades.length === 0
        ? Math.max(1, component.expectedEntries ?? 1)
        : Math.max(
            0,
            (component.expectedEntries ?? 0) - component.grades.length,
          );
    if (missingEntries === 0 || !fill) {
      plan.push({ weight: component.weightPercentage, grade: known });
      if (known === null) missingWeight += component.weightPercentage;
      continue;
    }
    const filled = computeComponentGrade(
      [...component.grades, ...Array<number>(missingEntries).fill(fill.grade)],
      component.aggregation,
      component.bestOfCount,
    );
    plan.push({ weight: component.weightPercentage, grade: filled });
    fills.push({
      label: component.name,
      kind: 'component',
      weightPercentage: component.weightPercentage,
      ...fill,
    });
  }

  const totalWeight = plan.reduce((sum, item) => sum + item.weight, 0);
  const projectedFinal = projectionIncomplete
    ? null
    : weightedAverage(projected);
  const planFinal = weightedAverage(plan);
  return {
    areaId,
    currentAverage: weightedAverage(current),
    projectedFinal,
    planFinal,
    delta:
      projectedFinal !== null && planFinal !== null
        ? round2(planFinal - projectedFinal)
        : null,
    plannedWeight: round2(totalWeight - missingWeight),
    missingWeight: round2(missingWeight),
    fills,
  };
}
