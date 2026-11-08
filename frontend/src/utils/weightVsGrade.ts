import type { Task } from '../types/models';

// Minimo de tasks com peso e nota para o coeficiente ter algum sentido.
export const MIN_WEIGHT_GRADE_SAMPLE = 3;
// |r| abaixo de WEAK_R = sem ligacao clara.
export const WEAK_R = 0.2;
// Fronteiras (em % do peso) dos baldes leve / medio / pesado.
export const LIGHT_MAX_WEIGHT = 10;
export const MEDIUM_MAX_WEIGHT = 25;

export type WeightBucketId = 'light' | 'medium' | 'heavy';
export type WeightCorrelationKind = 'higherOnHeavy' | 'lowerOnHeavy' | 'none';

export interface WeightGradeBucket {
  id: WeightBucketId;
  count: number;
  averageGrade: number | null;
}

export interface WeightVsGrade {
  sampleCount: number;
  // Pearson entre peso e nota; null sem amostra minima ou sem variancia.
  coefficient: number | null;
  kind: WeightCorrelationKind | null;
  buckets: WeightGradeBucket[];
}

const BUCKET_IDS: WeightBucketId[] = ['light', 'medium', 'heavy'];
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const hasValue = (v: number | null | undefined): v is number => v !== null && v !== undefined;
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < MIN_WEIGHT_GRADE_SAMPLE || n !== ys.length) return null;
  const mx = sum(xs) / n;
  const my = sum(ys) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

const bucketOf = (weight: number): WeightBucketId => {
  if (weight <= LIGHT_MAX_WEIGHT) return 'light';
  if (weight <= MEDIUM_MAX_WEIGHT) return 'medium';
  return 'heavy';
};

const kindOf = (r: number): WeightCorrelationKind => {
  if (Math.abs(r) < WEAK_R) return 'none';
  return r > 0 ? 'higherOnHeavy' : 'lowerOnHeavy';
};

// Peso da avaliacao vs a nota que saiu: tiras melhor nas que valem mais?
export function computeWeightVsGrade(tasks: Task[]): WeightVsGrade {
  const pairs = tasks
    .filter((t) => hasValue(t.weightPercentage) && t.weightPercentage > 0 && hasValue(t.realGrade))
    .map((t) => ({ weight: t.weightPercentage as number, grade: t.realGrade as number }));
  const r = pearson(
    pairs.map((p) => p.weight),
    pairs.map((p) => p.grade),
  );
  const buckets = BUCKET_IDS.map((id): WeightGradeBucket => {
    const inBucket = pairs.filter((p) => bucketOf(p.weight) === id);
    return {
      id,
      count: inBucket.length,
      averageGrade: inBucket.length > 0 ? round1(sum(inBucket.map((p) => p.grade)) / inBucket.length) : null,
    };
  });
  return {
    sampleCount: pairs.length,
    coefficient: r === null ? null : round2(r),
    kind: r === null ? null : kindOf(r),
    buckets,
  };
}
