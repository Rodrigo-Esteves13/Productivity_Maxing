// Relação entre minutos de estudo e nota obtida, ajustada ao teu
// histórico. Funções puras (sem BD) para se testarem à parte.
//
// Honestidade acima de tudo: com poucas tasks ou sem relação clara entre
// estudo e nota, o resultado é "sem previsão" em vez de um número bonito.

// Mínimo de tasks (concluídas, com nota e com tempo registado) para
// ajustar um modelo. Com menos, uma reta passa por qualquer coisa.
export const MIN_SAMPLES_COURSE = 5;
export const MIN_SAMPLES_OVERALL = 6;

// Abaixo disto de r² o estudo explica menos de ~15% da variação das notas:
// o declive pode ser puro acaso, por isso não se projeta nada.
export const MIN_R_SQUARED = 0.15;

// Sessões acima disto numa só task são quase de certeza uma sessão
// esquecida ligada, e arruinariam o ajuste.
export const MAX_SAMPLE_MINUTES = 1500;
// Abaixo disto o tempo registado é ruído (abriu e fechou a sessão).
export const MIN_SAMPLE_MINUTES = 10;

// z de ~80% (mesmo intervalo que o PredictionService usa nos minutos).
const Z_80 = 1.2816;

export interface GradeSample {
  minutes: number;
  // Nota normalizada para 0..1 na escala do curso ((nota - min) / (max - min)).
  fraction: number;
}

export interface GradeModel {
  intercept: number;
  slope: number;
  rSquared: number;
  residualStd: number;
  sampleSize: number;
}

export type ModelOutcome =
  | { kind: 'ok'; model: GradeModel }
  | { kind: 'not_enough_data'; sampleSize: number }
  | { kind: 'no_clear_link'; sampleSize: number; rSquared: number };

// Retornos decrescentes: a 1.ª hora vale mais do que a 10.ª.
function toFeature(minutes: number): number {
  return Math.log(1 + minutes / 60);
}

export function cleanSamples(samples: GradeSample[]): GradeSample[] {
  return samples.filter(
    (s) =>
      Number.isFinite(s.minutes) &&
      Number.isFinite(s.fraction) &&
      s.minutes >= MIN_SAMPLE_MINUTES &&
      s.minutes <= MAX_SAMPLE_MINUTES &&
      s.fraction >= 0 &&
      s.fraction <= 1,
  );
}

export function fitGradeModel(
  rawSamples: GradeSample[],
  minSamples: number,
): ModelOutcome {
  const samples = cleanSamples(rawSamples);
  const n = samples.length;
  if (n < minSamples) return { kind: 'not_enough_data', sampleSize: n };

  const xs = samples.map((s) => toFeature(s.minutes));
  const ys = samples.map((s) => s.fraction);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  // Estudaste (quase) sempre o mesmo tempo, ou tiraste sempre a mesma
  // nota: não há variação para tirar uma relação.
  if (sxx < 1e-9 || syy < 1e-9) {
    return { kind: 'no_clear_link', sampleSize: n, rSquared: 0 };
  }

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const rSquared = (sxy * sxy) / (sxx * syy);

  if (slope <= 0 || rSquared < MIN_R_SQUARED) {
    return { kind: 'no_clear_link', sampleSize: n, rSquared };
  }

  let sumSquaredResiduals = 0;
  for (let i = 0; i < n; i++) {
    const residual = ys[i] - (intercept + slope * xs[i]);
    sumSquaredResiduals += residual * residual;
  }
  const residualStd = Math.sqrt(sumSquaredResiduals / Math.max(1, n - 2));

  return {
    kind: 'ok',
    model: { intercept, slope, rSquared, residualStd, sampleSize: n },
  };
}

const clampFraction = (value: number) => Math.min(1, Math.max(0, value));

export interface FractionProjection {
  expected: number;
  low: number;
  high: number;
}

export function projectFraction(
  model: GradeModel,
  minutes: number,
): FractionProjection {
  const expected = model.intercept + model.slope * toFeature(minutes);
  const margin = Z_80 * model.residualStd;
  return {
    expected: clampFraction(expected),
    low: clampFraction(expected - margin),
    high: clampFraction(expected + margin),
  };
}

/** Quanto sobe a nota esperada (em fração da escala) por cada `extraMinutes` a mais. */
export function marginalFractionGain(
  model: GradeModel,
  minutes: number,
  extraMinutes: number,
): number {
  const before = projectFraction(model, minutes).expected;
  const after = projectFraction(model, minutes + extraMinutes).expected;
  return Math.max(0, after - before);
}

/**
 * Minutos de estudo para a nota esperada chegar a `targetFraction`, ou
 * null se nem com o maximo de estudo que os dados cobrem (MAX_SAMPLE_MINUTES)
 * o modelo la chega - nesse caso nao se promete nada.
 */
export function minutesForFraction(
  model: GradeModel,
  targetFraction: number,
): number | null {
  const ceiling = model.intercept + model.slope * toFeature(MAX_SAMPLE_MINUTES);
  if (targetFraction > ceiling) return null;
  const feature = (targetFraction - model.intercept) / model.slope;
  const minutes = (Math.exp(feature) - 1) * 60;
  return Math.max(0, Math.round(minutes));
}

export function fractionToGrade(
  fraction: number,
  scale: { min: number; max: number },
): number {
  return scale.min + fraction * (scale.max - scale.min);
}

export function gradeToFraction(
  grade: number,
  scale: { min: number; max: number },
): number {
  return (grade - scale.min) / (scale.max - scale.min);
}

export interface ChosenModel {
  outcome: ModelOutcome;
  basis: 'course' | 'overall';
}

/**
 * Escolhe o modelo da cadeira quando há dados que cheguem e a relação é
 * clara; senão cai no global (todas as cadeiras juntas). Uma cadeira com
 * relação fraca NÃO cai no global só para dar um número: só cai se tiver
 * poucos dados (a falta de dados é do curso, não uma conclusão).
 */
export function chooseModel(
  courseSamples: GradeSample[],
  overallOutcome: ModelOutcome,
): ChosenModel {
  const courseOutcome = fitGradeModel(courseSamples, MIN_SAMPLES_COURSE);
  if (courseOutcome.kind === 'ok') {
    return { outcome: courseOutcome, basis: 'course' };
  }
  if (courseOutcome.kind === 'no_clear_link') {
    return { outcome: courseOutcome, basis: 'course' };
  }
  return { outcome: overallOutcome, basis: 'overall' };
}
