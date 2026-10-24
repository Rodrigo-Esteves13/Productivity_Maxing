import { FULL_PERCENT } from '../lib/percent';
import type { Area, GradeComponent, Task } from '../types/models';

// So se avisa com pelo menos isto da nota ja avaliado: com 5% avaliado uma
// nota baixa ainda nao diz nada.
export const MIN_GRADED_WEIGHT_PCT = 15;
// "Precisas de muito": nota necessaria no resto acima da nota minima mais
// esta fracao da escala (em 0-20 com minima 10: acima de 15).
export const HIGH_NEED_SCALE_RATIO = 0.25;

export type FailingRiskLevel = 'impossible' | 'high' | 'watch';

export interface FailingRiskRow {
  area: Area;
  level: FailingRiskLevel;
  // Media do que ja foi avaliado (ponderada pelos pesos).
  currentAverage: number;
  gradedWeightPct: number;
  remainingWeightPct: number;
  // Nota media necessaria no peso que falta para acabar na nota minima.
  // null quando ja nao falta peso nenhum.
  neededOnRest: number | null;
}

interface ScaleBounds {
  min: number;
  max: number;
}

export function parseScaleBounds(scale: string): ScaleBounds {
  const [min, max] = scale.split('-').map(Number);
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : 20;
  return { min: safeMin, max: safeMax };
}

// Mesma regra do backend (getPassThreshold em grade-average.util.ts).
export function passThreshold({ min, max }: ScaleBounds): number {
  return min + (max - min) / 2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface GradedItem {
  grade: number;
  weight: number;
}

// Itens com peso explicito. Sem peso em todas as tasks avaliaveis da cadeira
// nao da para saber quanto da nota ja esta decidido: a cadeira fica de fora.
function gradedItems(tasks: Task[], components: GradeComponent[]): GradedItem[] | null {
  const weightedTasks = tasks.filter((t) => t.weightPercentage !== null);
  if (weightedTasks.length !== tasks.length) return null;
  return [
    ...weightedTasks
      .filter((t) => t.realGrade !== null)
      .map((t) => ({ grade: t.realGrade as number, weight: t.weightPercentage as number })),
    ...components
      .filter((c) => c.grade !== null)
      .map((c) => ({ grade: c.grade as number, weight: c.weightPercentage })),
  ];
}

function classify(neededOnRest: number | null, currentAverage: number, pass: number, bounds: ScaleBounds): FailingRiskLevel | null {
  if (neededOnRest === null) return currentAverage < pass ? 'impossible' : null;
  if (neededOnRest > bounds.max) return 'impossible';
  if (neededOnRest >= pass + (bounds.max - bounds.min) * HIGH_NEED_SCALE_RATIO) return 'high';
  return currentAverage < pass ? 'watch' : null;
}

const LEVEL_ORDER: Record<FailingRiskLevel, number> = { impossible: 0, high: 1, watch: 2 };

// Cadeiras em risco de chumbar: com o que ja esta avaliado, que nota media
// e precisa no resto (o que falta ate 100%) para acabar na nota minima.
export function computeFailingRisk(
  tasks: Task[],
  areas: Area[],
  components: GradeComponent[],
  scale: string,
): FailingRiskRow[] {
  const bounds = parseScaleBounds(scale);
  const pass = passThreshold(bounds);
  const rows: FailingRiskRow[] = [];

  for (const area of areas) {
    const items = gradedItems(
      tasks.filter((t) => t.areaId === area.id),
      components.filter((c) => c.areaId === area.id),
    );
    if (!items || items.length === 0) continue;
    const gradedWeight = items.reduce((s, i) => s + i.weight, 0);
    if (gradedWeight < MIN_GRADED_WEIGHT_PCT) continue;

    const earned = items.reduce((s, i) => s + i.grade * i.weight, 0);
    const currentAverage = earned / gradedWeight;
    const remaining = Math.max(0, FULL_PERCENT - gradedWeight);
    const neededOnRest = remaining > 0 ? (pass * FULL_PERCENT - earned) / remaining : null;
    const level = classify(neededOnRest, currentAverage, pass, bounds);
    if (!level) continue;

    rows.push({
      area,
      level,
      currentAverage: round1(currentAverage),
      gradedWeightPct: Math.round(Math.min(gradedWeight, FULL_PERCENT)),
      remainingWeightPct: Math.round(remaining),
      neededOnRest: neededOnRest === null ? null : round1(Math.max(bounds.min, neededOnRest)),
    });
  }

  return rows.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
