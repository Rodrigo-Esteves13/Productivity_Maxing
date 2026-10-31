import { roundTo } from '../common/round.util';
import { pearsonCoefficient } from '../wellbeing/correlation.util';
import { teacherKey } from '../area-teachers/area-teachers.constants';
import {
  EPSILON,
  LIKED_MIN_RATING,
  MIN_PAIRS_FOR_COEFFICIENT,
  NOT_LIKED_MAX_RATING,
  RATING_STATS_DECIMALS,
  RATING_STATS_MIN_SAMPLE,
} from './area-ratings.constants';
import type {
  CorrelationReason,
  RatingCorrelation,
  RatingCourseRow,
  RatingQuadrants,
  RatingStats,
  TeacherRatingSummary,
} from './area-ratings.types';

type NumericField = {
  [K in keyof RatingCourseRow]: RatingCourseRow[K] extends number | null
    ? K
    : never;
}[keyof RatingCourseRow];

export const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, v) => sum + v, 0) / values.length;

const roundOrNull = (value: number | null): number | null =>
  value === null ? null : roundTo(value, RATING_STATS_DECIMALS);

/**
 * Ordens (1..n) com empates a receberem a ordem media, como manda o
 * Spearman: [10, 20, 20, 30] -> [1, 2.5, 2.5, 4].
 */
export function averageRanks(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      Math.abs(order[end + 1].value - order[start].value) <= EPSILON
    )
      end++;
    // Posicoes start..end (0-based) partilham a media das ordens 1-based.
    const rank = (start + end) / 2 + 1;
    for (let i = start; i <= end; i++) ranks[order[i].index] = rank;
    start = end + 1;
  }
  return ranks;
}

function correlationReason(
  r: number | null,
  enough: boolean,
): CorrelationReason | null {
  if (!enough) return 'insufficient';
  return r === null ? 'no_variation' : null;
}

/**
 * Spearman = Pearson sobre as ordens medias. r null com menos de
 * MIN_PAIRS_FOR_COEFFICIENT pares ou sem variacao num dos lados; enough so
 * com pelo menos RATING_STATS_MIN_SAMPLE pares.
 */
export function spearman(pairs: [number, number][]): RatingCorrelation {
  const n = pairs.length;
  const enough = n >= RATING_STATS_MIN_SAMPLE;
  if (n < MIN_PAIRS_FOR_COEFFICIENT) {
    return { r: null, n, enough, reason: 'insufficient' };
  }
  const xRanks = averageRanks(pairs.map(([x]) => x));
  const yRanks = averageRanks(pairs.map(([, y]) => y));
  const coefficient = pearsonCoefficient(
    xRanks.map((x, i): [number, number] => [x, yRanks[i]]),
  );
  const r = roundOrNull(coefficient);
  return { r, n, enough, reason: correlationReason(r, enough) };
}

/** Pares (x, y) das cadeiras que tem os dois valores. */
function pairsOf(
  rows: RatingCourseRow[],
  x: NumericField,
  y: NumericField,
): [number, number][] {
  return rows.flatMap((row) => {
    const a = row[x];
    const b = row[y];
    return a === null || b === null ? [] : [[a, b] as [number, number]];
  });
}

const emptyQuadrants = (): RatingQuadrants => ({
  likedGradeHigh: 0,
  likedGradeLow: 0,
  notLikedGradeHigh: 0,
  notLikedGradeLow: 0,
});

// Lookup (gostou?, nota alta?) -> quadrante. Avaliacao 3 nao tem entrada.
const QUADRANT_KEY: Record<
  'liked' | 'notLiked',
  Record<'high' | 'low', keyof RatingQuadrants>
> = {
  liked: { high: 'likedGradeHigh', low: 'likedGradeLow' },
  notLiked: { high: 'notLikedGradeHigh', low: 'notLikedGradeLow' },
};

function likingBucket(rating: number): 'liked' | 'notLiked' | null {
  if (rating >= LIKED_MIN_RATING) return 'liked';
  if (rating <= NOT_LIKED_MAX_RATING) return 'notLiked';
  return null;
}

/**
 * "Nota alta" = estritamente acima da media das cadeiras com nota, com folga
 * EPSILON (notas iguais nunca contam como altas por erro de arredondamento).
 */
export function buildQuadrants(
  rows: RatingCourseRow[],
  field: 'teacherRating' | 'courseLiking',
): RatingQuadrants {
  const quadrants = emptyQuadrants();
  const meanGrade = mean(
    rows.flatMap((r) => (r.gradeFraction === null ? [] : [r.gradeFraction])),
  );
  if (meanGrade === null) return quadrants;
  for (const row of rows) {
    const rating = row[field];
    if (rating === null || row.gradeFraction === null) continue;
    const bucket = likingBucket(rating);
    if (!bucket) continue;
    const level = row.gradeFraction - meanGrade > EPSILON ? 'high' : 'low';
    quadrants[QUADRANT_KEY[bucket][level]] += 1;
  }
  return quadrants;
}

/** Agrupa por docente (mesma chave que N45: sem maiusculas nem espacos). */
export function buildByTeacher(
  rows: RatingCourseRow[],
): TeacherRatingSummary[] {
  const groups = new Map<string, { name: string; rows: RatingCourseRow[] }>();
  for (const row of rows) {
    if (!row.teacherName) continue;
    const key = teacherKey(row.teacherName);
    const group = groups.get(key) ?? { name: row.teacherName.trim(), rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ name, rows: teacherRows }) => ({
      teacherName: name,
      courses: teacherRows.length,
      avgRating: roundOrNull(
        mean(teacherRows.flatMap((r) => r.teacherRating ?? [])),
      ),
      avgGradeFraction: roundOrNull(
        mean(teacherRows.flatMap((r) => r.gradeFraction ?? [])),
      ),
    }))
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName));
}

export function buildRatingStats(rows: RatingCourseRow[]): RatingStats {
  return {
    minSample: RATING_STATS_MIN_SAMPLE,
    courses: rows,
    quadrants: {
      teacher: buildQuadrants(rows, 'teacherRating'),
      course: buildQuadrants(rows, 'courseLiking'),
    },
    correlations: {
      teacherVsGrade: spearman(pairsOf(rows, 'teacherRating', 'gradeFraction')),
      courseVsGrade: spearman(pairsOf(rows, 'courseLiking', 'gradeFraction')),
      focusVsGrade: spearman(pairsOf(rows, 'avgFocus', 'gradeFraction')),
      courseVsFocus: spearman(pairsOf(rows, 'courseLiking', 'avgFocus')),
    },
    byTeacher: buildByTeacher(rows),
  };
}
