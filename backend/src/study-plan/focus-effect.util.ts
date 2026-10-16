// Quanto o foco (1 a 5) das sessoes e o interesse na cadeira (1 a 5) mexem
// na nota, a minutos de estudo iguais, nos DADOS DA PROPRIA PESSOA. Funcoes
// puras (sem BD).
//
// Preditores (indices): 0 constante, 1 tempo, 2 foco, 3 interesse.
// Regressao linear: nota = a + b1 * log(1 + horas) + b2 * foco [+ b3 * interesse].
// Honestidade acima de tudo: com poucos dados, sem variacao, ou com um
// efeito que o acaso explica, o resultado diz isso em vez de inventar um
// numero.
import { RATING_MAX, RATING_MIN } from '../common/rating.constants';
import {
  MAX_SAMPLE_MINUTES,
  MIN_SAMPLE_MINUTES,
} from './grade-projection.util';

// Tasks avaliadas com sessoes classificadas: com menos, tres parametros
// (base, tempo, foco) ajustam-se a qualquer coisa.
export const MIN_FOCUS_SAMPLES = 8;

// Interesse tem mais um parametro e, sobretudo, so varia entre cadeiras:
// pede mais tasks e cadeiras distintas com interesse diferente, senao o
// "efeito" e so a dificuldade de cada cadeira disfarcada.
export const MIN_INTEREST_SAMPLES = 12;
export const MIN_INTEREST_AREAS = 4;

// Desvio-padrao minimo (em pontos de 1 a 5). Se quase sempre dai o mesmo
// valor, nao ha como medir o seu efeito.
export const MIN_RATING_STD = 0.4;

// Minimo da parte do tempo da task que tem de estar classificada para o
// foco medio da task valer alguma coisa.
export const MIN_RATED_SHARE = 0.5;

const MINUTES_PER_HOUR = 60;
// Determinante abaixo disto: os fatores andam colados (colinearidade).
const SINGULAR_PIVOT = 1e-9;
const FOCUS_INDEX = 2;
const INTEREST_INDEX = 3;

// t critico bilateral a 80% (mesmo intervalo dos outros modelos), df 1..30.
const T_CRITICAL_80 = [
  3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363,
  1.356, 1.35, 1.345, 1.341, 1.337, 1.333, 1.33, 1.328, 1.325, 1.323, 1.321,
  1.319, 1.318, 1.316, 1.315, 1.314, 1.313, 1.311, 1.31,
];
const T_CRITICAL_80_LARGE_DF = 1.282;

export interface FocusSample {
  minutes: number;
  // Foco medio da task (1..5), ponderado pelos minutos de cada sessao.
  focus: number;
  // Nota normalizada para 0..1 na escala do curso.
  fraction: number;
  // Interesse do user na cadeira (1..5), se o classificou.
  interest?: number;
  // Cadeira da task: o interesse so varia entre cadeiras.
  areaId?: string;
}

export type EffectOutcome =
  | { kind: 'not_enough_data'; sampleSize: number }
  | { kind: 'no_variation'; sampleSize: number }
  | { kind: 'inconclusive'; sampleSize: number; effect: number }
  | {
      kind: 'clear';
      sampleSize: number;
      // Fracao da escala por cada ponto a mais (pode ser negativo).
      effect: number;
      low: number;
      high: number;
    };

function tCritical(degreesOfFreedom: number): number {
  if (degreesOfFreedom < 1) return Infinity;
  return T_CRITICAL_80[degreesOfFreedom - 1] ?? T_CRITICAL_80_LARGE_DF;
}

const isRating = (value: number) => value >= RATING_MIN && value <= RATING_MAX;

export function cleanFocusSamples(samples: FocusSample[]): FocusSample[] {
  return samples.filter(
    (s) =>
      Number.isFinite(s.minutes) &&
      Number.isFinite(s.focus) &&
      Number.isFinite(s.fraction) &&
      s.minutes >= MIN_SAMPLE_MINUTES &&
      s.minutes <= MAX_SAMPLE_MINUTES &&
      isRating(s.focus) &&
      s.fraction >= 0 &&
      s.fraction <= 1 &&
      (s.interest === undefined ||
        (Number.isFinite(s.interest) && isRating(s.interest))),
  );
}

// Inversa por Gauss-Jordan com pivot parcial; null se a matriz e singular.
function invert(matrix: number[][]): number[][] | null {
  const size = matrix.length;
  const work = matrix.map((row, r) => [
    ...row,
    ...Array.from({ length: size }, (_, c) => (r === c ? 1 : 0)),
  ]);
  for (let col = 0; col < size; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < size; r++) {
      if (Math.abs(work[r][col]) > Math.abs(work[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(work[pivotRow][col]) < SINGULAR_PIVOT) return null;
    [work[col], work[pivotRow]] = [work[pivotRow], work[col]];
    const pivot = work[col][col];
    work[col] = work[col].map((value) => value / pivot);
    for (let r = 0; r < size; r++) {
      if (r === col) continue;
      const factor = work[r][col];
      work[r] = work[r].map((value, c) => value - factor * work[col][c]);
    }
  }
  return work.map((row) => row.slice(size));
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Minimos quadrados; devolve o efeito (coeficiente) e a margem a 80% do
// preditor `index`, ou null se os fatores forem colineares.
function fitOls(
  rows: number[][],
  ys: number[],
  index: number,
): { effect: number; margin: number } | null {
  const size = rows[0].length;
  const xtx = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );
  const xty = new Array<number>(size).fill(0);
  rows.forEach((row, k) => {
    for (let r = 0; r < size; r++) {
      xty[r] += row[r] * ys[k];
      for (let c = 0; c < size; c++) xtx[r][c] += row[r] * row[c];
    }
  });

  const inverse = invert(xtx);
  if (!inverse) return null;
  const beta = inverse.map((row) =>
    row.reduce((sum, v, c) => sum + v * xty[c], 0),
  );

  let sumSquaredResiduals = 0;
  rows.forEach((row, k) => {
    const predicted = row.reduce((sum, v, c) => sum + v * beta[c], 0);
    sumSquaredResiduals += (ys[k] - predicted) ** 2;
  });
  const degreesOfFreedom = rows.length - size;
  const variance = sumSquaredResiduals / degreesOfFreedom;
  const standardError = Math.sqrt(
    Math.max(0, variance * inverse[index][index]),
  );
  return {
    effect: beta[index],
    margin: tCritical(degreesOfFreedom) * standardError,
  };
}

function toOutcome(
  fit: { effect: number; margin: number } | null,
  sampleSize: number,
): EffectOutcome {
  if (!fit) return { kind: 'no_variation', sampleSize };
  if (Math.abs(fit.effect) <= fit.margin) {
    return { kind: 'inconclusive', sampleSize, effect: fit.effect };
  }
  return {
    kind: 'clear',
    sampleSize,
    effect: fit.effect,
    low: fit.effect - fit.margin,
    high: fit.effect + fit.margin,
  };
}

const timeFeature = (minutes: number) =>
  Math.log(1 + minutes / MINUTES_PER_HOUR);

/** Efeito do foco na nota, a tempo de estudo igual. */
export function fitFocusEffect(rawSamples: FocusSample[]): EffectOutcome {
  const samples = cleanFocusSamples(rawSamples);
  const n = samples.length;
  if (n < MIN_FOCUS_SAMPLES) return { kind: 'not_enough_data', sampleSize: n };
  if (standardDeviation(samples.map((s) => s.focus)) < MIN_RATING_STD) {
    return { kind: 'no_variation', sampleSize: n };
  }
  const rows = samples.map((s) => [1, timeFeature(s.minutes), s.focus]);
  return toOutcome(
    fitOls(
      rows,
      samples.map((s) => s.fraction),
      FOCUS_INDEX,
    ),
    n,
  );
}

/**
 * Efeito do interesse na cadeira na nota, a tempo e foco iguais. So usa
 * tasks de cadeiras em que classificaste o interesse, e exige varias
 * cadeiras com interesse diferente (ver MIN_INTEREST_AREAS).
 */
export function fitInterestEffect(rawSamples: FocusSample[]): EffectOutcome {
  const samples = cleanFocusSamples(rawSamples).filter(
    (s) => s.interest !== undefined,
  );
  const n = samples.length;
  const areaCount = new Set(samples.map((s) => s.areaId)).size;
  if (n < MIN_INTEREST_SAMPLES || areaCount < MIN_INTEREST_AREAS) {
    return { kind: 'not_enough_data', sampleSize: n };
  }
  const interests = samples.map((s) => s.interest as number);
  if (standardDeviation(interests) < MIN_RATING_STD) {
    return { kind: 'no_variation', sampleSize: n };
  }
  const rows = samples.map((s) => [
    1,
    timeFeature(s.minutes),
    s.focus,
    s.interest as number,
  ]);
  return toOutcome(
    fitOls(
      rows,
      samples.map((s) => s.fraction),
      INTEREST_INDEX,
    ),
    n,
  );
}
