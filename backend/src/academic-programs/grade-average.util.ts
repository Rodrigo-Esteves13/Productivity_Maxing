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
  roundFinalGrade: boolean,
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

    // Each subject's own final grade is what gets rounded (e.g. 17.6 -> 18)
    // - the credit-weighted average below is the normal, unrounded
    // calculation over those (possibly rounded) subject grades.
    const finalAreaGrade = roundAreaGrade(areaAverage.average, roundFinalGrade);

    const weight = creditsByArea.get(areaId) ?? 1;
    weightedSum += (finalAreaGrade as number) * weight;
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

// Rounds a single Area's weighted average to the nearest whole number, when
// the effective roundFinalGrade setting (period override, or the program
// default if the period doesn't set one) is true. This is what most unis
// actually do: each subject's own final grade gets rounded (e.g. 17.6 -> 18),
// and the semester/program average is then the normal credit-weighted
// average of those already-rounded subject grades - the average itself is
// never rounded again.
export function roundAreaGrade(
  average: number | null,
  roundFinalGrade: boolean,
): number | null {
  if (average === null || !roundFinalGrade) return average;
  return Math.round(average);
}

// Resolves the effective rounding setting for a period: its own override
// if set, otherwise the program's default.
export function resolveRoundFinalGrade(
  programDefault: boolean,
  periodOverride: boolean | null | undefined,
): boolean {
  return periodOverride ?? programDefault;
}

// Parses the "min-max" gradeScale string stored on AcademicProgram (e.g.
// "0-20", "0-100") into numbers. Falls back to the app's original default
// (0-20) for any value that doesn't match the expected shape, rather than
// throwing - a malformed/legacy gradeScale shouldn't take down the whole
// credits summary endpoint.
export interface ParsedGradeScale {
  min: number;
  max: number;
}

const DEFAULT_GRADE_SCALE: ParsedGradeScale = { min: 0, max: 20 };

export function parseGradeScale(gradeScale: string): ParsedGradeScale {
  const match = /^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(gradeScale.trim());
  if (!match) return DEFAULT_GRADE_SCALE;

  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return DEFAULT_GRADE_SCALE;
  }
  return { min, max };
}

// The pass mark for a scale, used only for the ECTS credits counter below.
// There's no "passing grade" concept stored anywhere in the schema (the
// app has never needed one before this), so this uses the simplest
// reasonable convention - the midpoint of the scale (e.g. 10/20, 50/100) -
// documented here so it's easy to swap for a per-program configurable
// value later if that becomes an explicit idea in the backlog.
export function getPassThreshold(gradeScale: string): number {
  const { min, max } = parseGradeScale(gradeScale);
  return min + (max - min) / 2;
}

export interface CreditsAreaSummary {
  areaId: string;
  areaName: string;
  credits: number | null;
  average: number | null;
  passed: boolean;
}

export interface CreditsSummary {
  programId: string;
  programName: string;
  gradeScale: string;
  passThreshold: number;
  // Sum of Area.credits for Areas whose weighted average is at/above
  // passThreshold. Areas without credits set contribute 0 here (there's
  // nothing numeric to add), even if they'd otherwise count as passed.
  earnedCredits: number;
  // Sum of Area.credits for every Area with at least one graded task,
  // pass or fail - lets the frontend show "X of Y ECTS attempted" instead
  // of just a bare earned number with no context.
  attemptedCredits: number;
  areas: CreditsAreaSummary[];
}

export function computeCreditsSummary(
  programId: string,
  programName: string,
  gradeScale: string,
  tasks: AreaGradedTaskLike[],
  areas: (AreaCreditsLike & { name: string })[],
  roundFinalGrade: boolean,
): CreditsSummary {
  const passThreshold = getPassThreshold(gradeScale);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const tasksByArea = new Map<string, AreaGradedTaskLike[]>();
  for (const task of tasks) {
    const bucket = tasksByArea.get(task.areaId);
    if (bucket) {
      bucket.push(task);
    } else {
      tasksByArea.set(task.areaId, [task]);
    }
  }

  let earnedCredits = 0;
  let attemptedCredits = 0;
  const areaSummaries: CreditsAreaSummary[] = [];

  for (const [areaId, areaTasks] of tasksByArea) {
    const area = areaById.get(areaId);
    if (!area) continue; // shouldn't happen (FK integrity), but never trust it blindly

    const { average: rawAverage } = computeWeightedAverage(areaTasks);
    if (rawAverage === null) continue; // no graded task yet in this Area - not "attempted"

    // Same subject-level rounding as computeCreditWeightedAverage - pass/fail
    // is judged on the grade as the uni would actually record it.
    const average = roundAreaGrade(rawAverage, roundFinalGrade) as number;

    const passed = average >= passThreshold;
    if (area.credits !== null) {
      attemptedCredits += area.credits;
      if (passed) earnedCredits += area.credits;
    }

    areaSummaries.push({
      areaId,
      areaName: area.name,
      credits: area.credits,
      average,
      passed,
    });
  }

  return {
    programId,
    programName,
    gradeScale,
    passThreshold,
    earnedCredits,
    attemptedCredits,
    areas: areaSummaries,
  };
}
