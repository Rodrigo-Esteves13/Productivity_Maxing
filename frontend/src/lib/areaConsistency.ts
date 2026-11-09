import type { Area, Task } from '../types/models';
import { wasCompletedOnTime } from '../utils/deadlineCompliance';
import { FULL_PERCENT } from './percent';

// Minimum graded tasks an area needs before its consistency means anything.
export const MIN_GRADED_TASKS_PER_AREA = 3;
// Minimum areas that must qualify for the widget to be worth showing.
export const MIN_QUALIFYING_AREAS = 2;
// Largest possible standard deviation of values bounded to [0, max] is
// max / 2 (half at each extreme); spread is normalized against that.
export const MAX_SPREAD_FRACTION = 0.5;
// Score weights (sum to 1). With no judgeable completions the spread part
// carries the whole score.
export const SPREAD_WEIGHT = 0.7;
export const ON_TIME_WEIGHT = 0.3;
// Bucket lower bounds on the 0-100 score.
export const STEADY_MIN_SCORE = 70;
export const MIXED_MIN_SCORE = 45;

export type ConsistencyBucket = 'steady' | 'mixed' | 'volatile';

export interface AreaConsistency {
  areaId: string;
  name: string;
  gradedCount: number;
  score: number; // 0-100, higher = more consistent
  bucket: ConsistencyBucket;
}

const hasGrade = (t: Task): t is Task & { realGrade: number } =>
  t.realGrade !== null && t.realGrade !== undefined && Number.isFinite(t.realGrade);

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function bucketForScore(score: number): ConsistencyBucket {
  if (score >= STEADY_MIN_SCORE) return 'steady';
  if (score >= MIXED_MIN_SCORE) return 'mixed';
  return 'volatile';
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// 0-100 from grade spread (1 - normalized std dev) blended with on-time rate.
export function consistencyScore(grades: number[], onTimeRate: number | null, max: number): number {
  const spread = clamp01(standardDeviation(grades) / (max * MAX_SPREAD_FRACTION));
  const steadiness = 1 - spread;
  const blended =
    onTimeRate === null ? steadiness : SPREAD_WEIGHT * steadiness + ON_TIME_WEIGHT * onTimeRate;
  return Math.round(blended * FULL_PERCENT);
}

// Areas ranked most to least consistent. Ties: more graded tasks first,
// then name. Areas under the minimum sample are left out.
export function computeAreaConsistency(tasks: Task[], areas: Area[], max: number): AreaConsistency[] {
  const result: AreaConsistency[] = [];
  for (const area of areas) {
    const graded = tasks.filter((t) => t.areaId === area.id && hasGrade(t));
    if (graded.length < MIN_GRADED_TASKS_PER_AREA) continue;
    const verdicts = graded
      .map((t) => wasCompletedOnTime(t))
      .filter((v): v is boolean => v !== null);
    const onTimeRate =
      verdicts.length > 0 ? verdicts.filter(Boolean).length / verdicts.length : null;
    const score = consistencyScore(
      graded.map((t) => t.realGrade as number),
      onTimeRate,
      max,
    );
    result.push({
      areaId: area.id,
      name: area.name,
      gradedCount: graded.length,
      score,
      bucket: bucketForScore(score),
    });
  }
  return result.sort(
    (a, b) => b.score - a.score || b.gradedCount - a.gradedCount || a.name.localeCompare(b.name),
  );
}
