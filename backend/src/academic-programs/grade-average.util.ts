// Weighted average by weight (Task.weightPercentage). Tasks without a
// realGrade (not graded yet) don't count - it wouldn't make sense to pull
// the average down with a "0" that isn't a real grade. Tasks with a
// realGrade but no weightPercentage set enter with weight 1 (they neither
// dominate the average nor get discarded - it happens in practice that you
// forget to set a test's weight).
export interface GradedTaskLike {
  realGrade: number | null;
  weightPercentage: number | null;
}

export interface WeightedAverageResult {
  average: number | null;
  gradedTaskCount: number;
  // Sum of the weights actually used to compute `average` - lets the
  // frontend simulate "what if I add one more graded item" without
  // needing a dedicated endpoint (see the dashboard credit simulator):
  // newAverage = (average*totalWeight + hypGrade*hypWeight) / (totalWeight+hypWeight).
  totalWeight: number;
}

export function computeWeightedAverage(
  tasks: GradedTaskLike[],
): WeightedAverageResult {
  const graded = tasks.filter(
    (t): t is GradedTaskLike & { realGrade: number } => t.realGrade != null,
  );

  if (graded.length === 0) {
    return { average: null, gradedTaskCount: 0, totalWeight: 0 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const t of graded) {
    const weight = t.weightPercentage ?? 1;
    weightedSum += t.realGrade * weight;
    totalWeight += weight;
  }

  const average = totalWeight > 0 ? weightedSum / totalWeight : null;
  return {
    // 2 decimal places is more than enough for any grade scale
    // (0-20, 0-100, 0-4 US GPA, ...).
    average: average !== null ? Math.round(average * 100) / 100 : null,
    gradedTaskCount: graded.length,
    totalWeight,
  };
}

// Second level of the calculation (credits): groups tasks by Area,
// computes each Area's weighted average with computeWeightedAverage()
// (level 1, unchanged), then weighs those averages by Area.credits to get
// the period/program average. Areas without credits set enter with weight
// 1 - same treatment a Task without weightPercentage already got, to keep
// the same philosophy across the app (never silently exclude something
// for missing an optional weight).
export interface AreaGradedTaskLike extends GradedTaskLike {
  areaId: string;
}

export interface AreaCreditsLike {
  id: string;
  credits: number | null;
}

export function computeCreditWeightedAverage(
  tasks: AreaGradedTaskLike[],
  areas: AreaCreditsLike[],
): WeightedAverageResult {
  const creditsByArea = new Map(areas.map((a) => [a.id, a.credits]));

  const tasksByArea = new Map<string, AreaGradedTaskLike[]>();
  for (const task of tasks) {
    const bucket = tasksByArea.get(task.areaId);
    if (bucket) {
      bucket.push(task);
    } else {
      tasksByArea.set(task.areaId, [task]);
    }
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let gradedTaskCount = 0;

  for (const [areaId, areaTasks] of tasksByArea) {
    const areaAverage = computeWeightedAverage(areaTasks);
    if (areaAverage.average === null) continue; // an Area with no graded tasks doesn't enter

    const weight = creditsByArea.get(areaId) ?? 1;
    weightedSum += areaAverage.average * weight;
    totalWeight += weight;
    gradedTaskCount += areaAverage.gradedTaskCount;
  }

  const average = totalWeight > 0 ? weightedSum / totalWeight : null;
  return {
    average: average !== null ? Math.round(average * 100) / 100 : null,
    gradedTaskCount,
    totalWeight,
  };
}
