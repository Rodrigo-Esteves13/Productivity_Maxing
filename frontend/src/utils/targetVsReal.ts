import type { Task, Area } from '../types/models';

export interface AreaGradeGap {
  area: Area;
  avgTarget: number;
  avgReal: number;
  gap: number; // real - target; negative = below target
  taskCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Per Area, over tasks that have BOTH a target and a real grade: weighted
// average of each (same weighting as AreaBreakdownCard: weightPercentage,
// falling back to 1 when unset), and the gap between them. Comparing
// averages over the same set of tasks keeps the two numbers honest - a
// target on an ungraded task, or a grade with no target, never skews one
// side only.
export function computeTargetVsReal(tasks: Task[], areas: Area[]): AreaGradeGap[] {
  const rows: AreaGradeGap[] = [];
  for (const area of areas) {
    const comparable = tasks.filter(
      (t) => t.areaId === area.id && t.targetGrade !== null && t.realGrade !== null,
    );
    if (comparable.length === 0) continue;

    let weightSum = 0;
    let targetSum = 0;
    let realSum = 0;
    for (const t of comparable) {
      const w = t.weightPercentage ?? 1;
      weightSum += w;
      targetSum += (t.targetGrade as number) * w;
      realSum += (t.realGrade as number) * w;
    }
    if (weightSum <= 0) continue;

    const avgTarget = round2(targetSum / weightSum);
    const avgReal = round2(realSum / weightSum);
    rows.push({ area, avgTarget, avgReal, gap: round2(avgReal - avgTarget), taskCount: comparable.length });
  }
  return rows.sort((a, b) => a.gap - b.gap); // furthest below target first
}
