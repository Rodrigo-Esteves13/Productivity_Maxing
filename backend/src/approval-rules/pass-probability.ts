import type { ApprovalRules } from './approval-rules.types';

// Probabilidade de passar com peso ainda por avaliar (N47, pessimista).
// Pura: sem Nest nem Prisma, e deterministica (PRNG com semente fixa, os
// mesmos numeros aleatorios em cada chamada, por isso a mesma entrada da
// sempre o mesmo resultado e pequenas mudancas de notas movem-na de forma
// previsivel).
//
// Modelo:
// - Cada componente que falta tira uma nota normal. A media vem da
//   media das notas ja tiradas (ponderada pelo peso) puxada para um prior
//   pessimista (poucas notas valem pouco; com 1 nota o prior pesa mais do que
//   ela); o desvio e o do prior, para a chance subir sempre que uma nota sobe.
// - Cada componente que falta tem ainda uma probabilidade de ser falhado por
//   motivos externos (doenca, bloqueio, falta), proporcional ao seu peso
//   (EXTERNAL_FAILURE_PROBABILITY vale para ASSUMED_COMPONENT_SHARE): conta como nota minima da
//   escala, o que parte o minimo por componente e gasta a quota do limiar
//   secundario.
// - Simula-se a continua inteira com as regras em dados (minimo por
//   componente, maximo abaixo do limiar secundario, media final arredondada).
// - Se a continua falha, a prova unica (exame, recurso) so salva com a
//   probabilidade de uma nota crua chegar a passagem, descontada pela
//   dificuldade de uma prova a 100% e por tentativas.
// - O resultado e ainda limitado por um teto que desce com o peso por avaliar.

/** Amostras da simulacao (erro tipico abaixo de 1 ponto percentual). */
const SIMULATION_SAMPLES = 4000;
/** Semente fixa do PRNG: resultados reproduziveis. */
const SIMULATION_SEED = 0x2f6e2b1;

/** Prior da nota de um componente futuro, como fracao da escala. */
const PRIOR_MEAN_SCALE_RATIO = 0.6;
const PRIOR_SD_SCALE_RATIO = 0.15;
/** Quantas "notas" o prior vale (peso do prior face as notas reais). */
const PRIOR_STRENGTH = 2;

/** Chance de um componente futuro de peso ASSUMED_COMPONENT_SHARE ser falhado por motivos externos. */
export const EXTERNAL_FAILURE_PROBABILITY = 0.05;
/** Dificuldade de uma prova unica a 100% face a um componente normal. */
export const SITTING_PASS_FACTOR = 0.65;

/** Peso por avaliar nao alocado a componentes: cada um assume-se deste tamanho (fracao 0-1). */
export const ASSUMED_COMPONENT_SHARE = 0.25;

/**
 * Teto da chance de passar (%) com peso por avaliar:
 * 100 - (BASE + PER_PCT * peso por avaliar em %).
 */
export const CEILING_BASE_RISK_PCT = 2;
export const CEILING_RISK_PER_REMAINING_PCT = 0.25;

const PERCENT = 100;
const FLOAT_EPSILON = 1e-9;
const ERF_A = [
  0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429,
];
const ERF_P = 0.3275911;
const SQRT_TWO = Math.SQRT2;
const TWO_PI = 2 * Math.PI;
const UINT32 = 4294967296;

export interface GradedShare {
  grade: number;
  /** Fracao (0-1) do peso total da cadeira. */
  share: number;
}

export interface PassModelInput {
  rules: ApprovalRules;
  /** Nota crua mais baixa que passa depois de arredondar. */
  passRaw: number;
  graded: readonly GradedShare[];
  /** Fracao (0-1) de cada componente que falta. Vazio = nota final fechada. */
  remainingShares: readonly number[];
  /** false = a continua ja esta decidida (so conta a prova unica). */
  continuousOpen: boolean;
  /** Provas unicas disponiveis (exame, recurso). */
  sittings: number;
  /** Arredonda uma nota final (ver applyRounding no motor). */
  round: (value: number) => number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

function normalCdf(z: number): number {
  const x = Math.abs(z) / SQRT_TWO;
  const t = 1 / (1 + ERF_P * x);
  const poly =
    ((((ERF_A[4] * t + ERF_A[3]) * t + ERF_A[2]) * t + ERF_A[1]) * t +
      ERF_A[0]) *
    t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * Nota normal de um componente futuro. A media e a das notas tiradas
 * (ponderada pelo peso), encolhida para o prior pessimista. O desvio e o do
 * prior e nao vem da dispersao das notas: com poucas notas essa dispersao e
 * pouco fiavel e faria uma nota mais alta poder baixar a chance de passar.
 */
export function futureGradeModel(
  graded: readonly GradedShare[],
  rules: ApprovalRules,
): { mean: number; sd: number } {
  const span = rules.scaleMax - rules.scaleMin;
  const priorMean = rules.scaleMin + PRIOR_MEAN_SCALE_RATIO * span;
  const k = graded.length;
  const totalShare = graded.reduce((acc, g) => acc + g.share, 0);
  const observedMean =
    k > 0 && totalShare > 0
      ? graded.reduce((acc, g) => acc + g.grade * g.share, 0) / totalShare
      : priorMean;
  const mean =
    (k * observedMean + PRIOR_STRENGTH * priorMean) / (k + PRIOR_STRENGTH);
  return { mean, sd: PRIOR_SD_SCALE_RATIO * span };
}

function countBelow(grades: readonly number[], threshold: number): number {
  return grades.filter((g) => g < threshold - FLOAT_EPSILON).length;
}

function violatesHardRules(
  grades: readonly number[],
  rules: ApprovalRules,
): boolean {
  const { componentMinGrade, secondThreshold, maxBelowSecondThreshold } = rules;
  if (
    componentMinGrade !== null &&
    grades.some((g) => g < componentMinGrade - FLOAT_EPSILON)
  ) {
    return true;
  }
  return (
    secondThreshold !== null &&
    maxBelowSecondThreshold !== null &&
    countBelow(grades, secondThreshold) > maxBelowSecondThreshold
  );
}

/** Chance de um componente futuro ser falhado: cresce com o seu peso. */
export function missProbability(share: number): number {
  return (
    1 - (1 - EXTERNAL_FAILURE_PROBABILITY) ** (share / ASSUMED_COMPONENT_SHARE)
  );
}

/** Probabilidade (0-1) de a continua passar, com os componentes futuros incertos. */
function continuousPassProbability(input: PassModelInput): number {
  const { rules, graded, remainingShares } = input;
  const gradedGrades = graded.map((g) => g.grade);
  // Regras duras ja violadas pelas notas tiradas: a continua nao passa.
  if (violatesHardRules(gradedGrades, rules)) return 0;
  const earned = graded.reduce((acc, g) => acc + g.grade * g.share, 0);
  const { mean, sd } = futureGradeModel(graded, rules);
  const { componentMinGrade, secondThreshold, maxBelowSecondThreshold } = rules;
  const gradedBelowSecond =
    secondThreshold === null ? 0 : countBelow(gradedGrades, secondThreshold);
  const missProbabilities = remainingShares.map(missProbability);
  const random = mulberry32(SIMULATION_SEED);
  const gauss = (): number =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TWO_PI * random());

  let passes = 0;
  for (let i = 0; i < SIMULATION_SAMPLES; i += 1) {
    let final = earned;
    let belowMin = false;
    let belowSecond = gradedBelowSecond;
    remainingShares.forEach((share, index) => {
      const missed = random() < missProbabilities[index];
      const drawn = mean + sd * gauss();
      const grade = missed
        ? rules.scaleMin
        : Math.min(rules.scaleMax, Math.max(rules.scaleMin, drawn));
      final += grade * share;
      if (
        componentMinGrade !== null &&
        grade < componentMinGrade - FLOAT_EPSILON
      ) {
        belowMin = true;
      }
      if (secondThreshold !== null && grade < secondThreshold - FLOAT_EPSILON) {
        belowSecond += 1;
      }
    });
    const quotaBroken =
      maxBelowSecondThreshold !== null && belowSecond > maxBelowSecondThreshold;
    const passesMark = input.round(final) >= rules.passMark - FLOAT_EPSILON;
    if (passesMark && !belowMin && !quotaBroken) passes += 1;
  }
  return passes / SIMULATION_SAMPLES;
}

/** Probabilidade (0-1) de passar so pelas provas unicas (exame, recurso). */
function sittingsPassProbability(input: PassModelInput): number {
  const { mean, sd } = futureGradeModel(input.graded, input.rules);
  const rawChance = 1 - normalCdf((input.passRaw - mean) / sd);
  const perSitting =
    (1 - EXTERNAL_FAILURE_PROBABILITY) * SITTING_PASS_FACTOR * rawChance;
  return 1 - (1 - perSitting) ** input.sittings;
}

/** Teto (%) da chance de passar para um peso por avaliar (%). 100 sem peso por avaliar. */
export function passCeilingPct(remainingWeightPct: number): number {
  if (!(remainingWeightPct > 0)) return PERCENT;
  return (
    PERCENT -
    (CEILING_BASE_RISK_PCT +
      CEILING_RISK_PER_REMAINING_PCT * remainingWeightPct)
  );
}

/**
 * Chance de passar em % (continua + prova unica), SEM o teto. Sem componentes
 * futuros a continua e determinista (a regra dura ou a media ja decidiram).
 */
export function modelPassPct(input: PassModelInput): number {
  if (!(input.rules.scaleMax > input.rules.scaleMin)) return 0;
  const continuous = input.continuousOpen
    ? continuousPassProbability(input)
    : 0;
  const fallback = sittingsPassProbability(input);
  return PERCENT * (continuous + (1 - continuous) * fallback);
}
