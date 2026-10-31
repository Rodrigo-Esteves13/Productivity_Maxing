import { roundTo } from '../common/round.util';
import type {
  ApprovalRounding,
  ApprovalRules,
  ApprovalTrack,
  CourseRisk,
  CourseRiskInput,
  RiskComponentInput,
  RiskLevel,
  RiskReason,
  RiskReasonCode,
} from './approval-rules.types';

// Motor puro do risco de chumbo (N45-N47). Sem Nest nem Prisma: recebe as
// regras ja resolvidas e os dados da cadeira e devolve o veredicto.
//
// Modelo:
// - Os pesos sao percentagens absolutas sobre max(100, soma dos pesos): um
//   70% avaliado sozinho deixa 30% por avaliar; 30+30 avaliados deixam 40%.
//   So fica fechada (nota final decidida) com 100% avaliado. Somas acima de
//   100 dividem-se pela soma.
// - Nucleo (domina o score): a media minima que falta tirar no peso restante,
//   medida na escala (dificuldade), mais a distancia entre esse minimo e a
//   media ja mostrada (pesada pela fracao ja avaliada).
// - Regras duras (componente abaixo do minimo, demasiados abaixo do limiar
//   secundario), nota final fechada abaixo da passagem ou meta impossivel no
//   peso restante decidem a continua: passa a contar a prova unica a 100%
//   (exame, depois recurso). Com prova o risco e "high" (depende de uma
//   tentativa), nunca "extreme" so por isso; sem prova nenhuma e chumbo.
// - Gravidade pelas notas: se o necessario no restante esta muito acima do
//   realista (>= SEVERE_NEED_SCALE_RATIO da escala, impossivel, ou fechada
//   abaixo da passagem) e a media mostrada esta bem abaixo da passagem, o
//   risco e "extreme" mesmo com exame e recurso (ex: 6 em 70% com 30% por
//   avaliar). Uma regra dura violada com pouco peso avaliado continua "high".
// - Peso por avaliar abaixo de SETTLED_SHARE_TOLERANCE conta como fechado
//   (33.33 x3 = 99.99 fecha a nota final).
// - Sinais secundarios (estudo, faltas, adiamentos) somam pouco e com teto.
//   O docente escala com o risco que ja existe: sozinho nunca decide.
//
// Params das razoes (nomes fixos, a UI ja traduz com eles; numeros a 1 casa):
//   COMPONENT_BELOW_MIN              label, grade, min
//   TOO_MANY_BELOW_SECOND_THRESHOLD  count, threshold, max
//   IMPOSSIBLE_ON_REMAINING          needed, remaining
//   HIGH_NEED_ON_REMAINING           needed, remaining
//   LOW_AVERAGE_SO_FAR               average, passMark
//   LOW_STUDY_TIME                   studied, estimated (minutos)
//   ABSENCE_NEAR_LIMIT               share, limit (percentagens)
//   ABSENCE_OVER_LIMIT               share, limit (percentagens)
//   POSTPONED_TASKS                  count
//   TEACHER_HISTORY_LOWER            teacher, withTeacher, others (na escala da cadeira)
//   ONLY_EXAM_TRACK_LEFT             track (EXAM ou RESIT, a prova que resta)
//
// LOW_AVERAGE_SO_FAR.average arredonda para baixo (1 casa) para nunca
// mostrar uma media igual a passagem e dizer que esta abaixo (9.96 -> 9.9).
//
// Docente: avgWithTeacher e avgOthers chegam normalizados 0-1 (fracao da
// escala), nao em valores de nota. A diferenca compara-se diretamente como
// fracao da escala; nos params convertem-se para a escala da cadeira.

/** Base das percentagens. */
const PERCENT = 100;
/** Tolerancia de virgula flutuante (9.4999999999 conta como 9.5). */
const FLOAT_EPSILON = 1e-9;
/** Meia unidade: fronteira do arredondamento "a meio sobe". */
const HALF_UNIT = 0.5;
/** Casas decimais dos numeros devolvidos e dos params. */
const DISPLAY_DECIMALS = 1;
/**
 * Peso por avaliar (fracao 0-1) que ainda conta como fechado: pesos como
 * 33.33 x3 somam 99.99 e nao podem deixar 0.01% "por avaliar".
 */
const SETTLED_SHARE_TOLERANCE = 0.005;

// Score e niveis.
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const MEDIUM_MIN_SCORE = 25;
const HIGH_MIN_SCORE = 50;
const EXTREME_MIN_SCORE = 80;
/** Do mais grave para o menos grave; ganha o primeiro que encaixa. */
const LEVEL_THRESHOLDS: readonly { minScore: number; level: RiskLevel }[] = [
  { minScore: EXTREME_MIN_SCORE, level: 'extreme' },
  { minScore: HIGH_MIN_SCORE, level: 'high' },
  { minScore: MEDIUM_MIN_SCORE, level: 'medium' },
  { minScore: SCORE_MIN, level: 'low' },
];

// Nucleo: dificuldade da media necessaria no peso restante.
/** d = 1: e preciso exatamente a nota de passagem crua (ex: 9.5) no resto. */
const DIFFICULTY_AT_PASS = 1;
/** d = 2: e preciso a nota maxima em tudo o que falta. */
const DIFFICULTY_AT_MAX = 2;
/**
 * Pontos por dificuldade, linear por trocos, pares [d, pontos].
 * 0..1 = do minimo da escala ate a passagem; 1..2 = da passagem ao maximo.
 */
const NEED_DIFFICULTY_CURVE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.5, 0],
  [0.8, 10],
  [DIFFICULTY_AT_PASS, 30],
  [1.5, 55],
  [DIFFICULTY_AT_MAX, 85],
];
/** A partir daqui a media necessaria vira razao (cobre todo o "medium"). */
const NEED_REASON_MIN_POINTS = MEDIUM_MIN_SCORE;
/** Distancia necessario - media atual (fracao da escala) que conta por inteiro. */
const PERFORMANCE_GAP_FULL_SPAN_RATIO = 0.5;
/** Pontos maximos dessa distancia, multiplicados pela fracao ja avaliada. */
const PERFORMANCE_GAP_MAX_POINTS = 20;
/** Teto do nucleo com a continua ainda possivel (abaixo de um chumbo decidido). */
const OPEN_TRACK_MAX_POINTS = 95;

/**
 * Risco quando a continua ja nao chega, indexado pelo numero de provas unicas
 * a 100% que restam (exame + recurso). Sem nenhuma: chumbo (maximo). Com
 * prova: base "high" mais a falta de media mostrada, nunca "extreme" so por
 * isso. shortfallMaxPoints multiplica (passagem - media)/passagem e a
 * fracao ja avaliada.
 */
const FALLBACK_BY_SITTINGS: readonly {
  base: number;
  shortfallMaxPoints: number;
}[] = [
  { base: SCORE_MAX, shortfallMaxPoints: 0 },
  { base: 58, shortfallMaxPoints: 15 },
  { base: 50, shortfallMaxPoints: 15 },
];

// Gravidade pelas notas (sobrepoe-se ao teto da prova unica).
/**
 * Necessario no restante, como fracao da escala, a partir do qual a continua
 * deixa de ser realista (17/20). Impossivel ou fechada abaixo da passagem
 * contam como acima de tudo.
 */
const SEVERE_NEED_SCALE_RATIO = 0.85;
/** Fracao da escala em que o necessario severo chega ao topo da curva. */
const SEVERE_NEED_FULL_SCALE_RATIO = 1;
/**
 * Distancia minima (fracao da escala) entre a media mostrada e a passagem
 * crua para haver gravidade. Perto da passagem (ex: 9.4 com 99% avaliado) o
 * necessario dispara so porque falta pouco peso, e a prova unica e realista.
 */
const SEVERE_MIN_AVERAGE_GAP_RATIO = 0.1;
/** Pontos por necessario severo, pares [fracao da escala, pontos]. */
const SEVERE_NEED_CURVE: readonly (readonly [number, number])[] = [
  [SEVERE_NEED_SCALE_RATIO, EXTREME_MIN_SCORE],
  [SEVERE_NEED_FULL_SCALE_RATIO, 88],
];
/** Pontos extra pela falta de media mostrada (weightedShortfall). */
const SEVERE_SHORTFALL_MAX_POINTS = 7;
/** Teto da gravidade com prova a seguir: abaixo de um chumbo decidido. */
const SEVERE_MAX_POINTS = OPEN_TRACK_MAX_POINTS;

/** Provas unicas a 100%, pela ordem em que o aluno as usa. */
const FALLBACK_TRACKS: readonly {
  track: ApprovalTrack;
  exists: (rules: ApprovalRules) => boolean;
}[] = [
  { track: 'EXAM', exists: (rules) => rules.hasExamTrack },
  { track: 'RESIT', exists: (rules) => rules.hasResitTrack },
];
/** Sem exame nem recurso a pista continua a ser a unica que houve. */
const NO_FALLBACK_TRACK: ApprovalTrack = 'CONTINUOUS';

// Sinais secundarios (pequenos, com teto).
/** Estudado/estimado abaixo disto conta como pouco estudo. */
const LOW_STUDY_RATIO = 0.5;
const LOW_STUDY_MAX_POINTS = 8;
/** Uso do limite de faltas (falta/limite); do mais grave para o menos. */
const ABSENCE_BANDS: readonly {
  minUsage: number;
  code: RiskReasonCode;
  points: number;
}[] = [
  { minUsage: 1, code: 'ABSENCE_OVER_LIMIT', points: 12 },
  { minUsage: 0.8, code: 'ABSENCE_NEAR_LIMIT', points: 6 },
];
const POSTPONED_MIN_COUNT = 2;
const POSTPONED_CAP_COUNT = 5;
const POSTPONED_POINTS_PER_TASK = 1.2;
/** Teto da soma estudo + faltas + adiamentos. */
const SECONDARY_MAX_POINTS = 20;
/** Docente: amostra minima para a media com ele ser informativa. */
const TEACHER_MIN_SAMPLE = 3;
/** Margem minima (fracao 0-1 da escala) entre as outras cadeiras e esta. */
const TEACHER_MIN_GAP_RATIO = 0.075;
/** Margem (fracao da escala) a partir da qual o sinal conta por inteiro. */
const TEACHER_FULL_GAP_RATIO = 0.25;
const TEACHER_MAX_POINTS = 5;
/** Risco ja existente com que o docente pesa por inteiro (abaixo, menos; 0 = nada). */
const TEACHER_FULL_EFFECT_SCORE = HIGH_MIN_SCORE;
/** Numa cadeira ja aprovada so as faltas ainda importam. */
const SIGNALS_RELEVANT_WHEN_PASSED: ReadonlySet<RiskReasonCode> =
  new Set<RiskReasonCode>(['ABSENCE_NEAR_LIMIT', 'ABSENCE_OVER_LIMIT']);

type ContinuousOutcome = 'open' | 'passed' | 'failed' | 'impossible';

interface GradedComponent {
  label: string;
  /** Fracao (0-1) do peso total da cadeira. */
  share: number;
  grade: number;
}

interface CourseContext {
  rules: ApprovalRules;
  /** scaleMax - scaleMin. */
  span: number;
  /** Nota crua mais baixa que, arredondada, chega a passMark (ex: 9.5). */
  passRaw: number;
  gradedShare: number;
  /** Sem peso por avaliar: a nota final ja esta fechada. */
  settled: boolean;
  /** Media ponderada so do que ja foi avaliado. */
  projected: number;
  /** Media minima no peso restante (inclui o minimo por componente). 0 se fechado. */
  needed: number;
  finalPasses: boolean;
  violations: RiskReason[];
}

interface ScoredReason extends RiskReason {
  /** Pontos com que a razao contribui; ordena a lista. */
  impact: number;
}

interface CoreScore {
  points: number;
  reasons: ScoredReason[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sum = (values: readonly number[]): number =>
  values.reduce((acc, value) => acc + value, 0);

const display = (value: number): number => roundTo(value, DISPLAY_DECIMALS);

const DISPLAY_FACTOR = 10 ** DISPLAY_DECIMALS;

/** Como display, mas sempre para baixo (nunca sobe ate a passagem). */
const displayFloor = (value: number): number =>
  Math.floor(value * DISPLAY_FACTOR + FLOAT_EPSILON) / DISPLAY_FACTOR;

const isPresent = <T>(value: T | null): value is T => value !== null;

const ROUNDERS: Record<ApprovalRounding, (value: number) => number> = {
  NONE: (value) => value,
  UP_TO_INTEGER_AT_HALF: (value) =>
    Math.floor(value + HALF_UNIT + FLOAT_EPSILON),
};

/** Nota crua mais baixa que passa depois de arredondar. */
const LOWEST_PASSING_RAW: Record<
  ApprovalRounding,
  (passMark: number) => number
> = {
  NONE: (passMark) => passMark,
  UP_TO_INTEGER_AT_HALF: (passMark) =>
    Math.ceil(passMark - FLOAT_EPSILON) - HALF_UNIT,
};

/** Arredonda uma nota final segundo as regras (9.5 -> 10 a meio sobe). */
export function applyRounding(value: number, rules: ApprovalRules): number {
  return ROUNDERS[rules.rounding](value);
}

function interpolate(
  curve: readonly (readonly [number, number])[],
  x: number,
): number {
  const [firstX, firstY] = curve[0];
  const [lastX, lastY] = curve[curve.length - 1];
  if (x <= firstX) return firstY;
  if (x >= lastX) return lastY;
  const upper = curve.findIndex(([px]) => px >= x);
  const [x0, y0] = curve[upper - 1];
  const [x1, y1] = curve[upper];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function levelFor(score: number): RiskLevel {
  const match = LEVEL_THRESHOLDS.find((t) => score >= t.minScore);
  return match ? match.level : 'low';
}

function countBelow(graded: GradedComponent[], threshold: number): number {
  return graded.filter((g) => g.grade < threshold - FLOAT_EPSILON).length;
}

// Regras duras sobre os componentes ja avaliados.
function checkComponentMin(
  graded: GradedComponent[],
  rules: ApprovalRules,
): RiskReason | null {
  const min = rules.componentMinGrade;
  if (min === null) return null;
  const below = graded.filter((g) => g.grade < min - FLOAT_EPSILON);
  if (below.length === 0) return null;
  const worst = below.reduce((a, b) => (b.grade < a.grade ? b : a));
  return {
    code: 'COMPONENT_BELOW_MIN',
    params: {
      label: worst.label,
      grade: display(worst.grade),
      min: display(min),
    },
  };
}

function checkSecondThreshold(
  graded: GradedComponent[],
  rules: ApprovalRules,
): RiskReason | null {
  const { secondThreshold, maxBelowSecondThreshold } = rules;
  if (secondThreshold === null || maxBelowSecondThreshold === null) return null;
  const count = countBelow(graded, secondThreshold);
  if (count <= maxBelowSecondThreshold) return null;
  return {
    code: 'TOO_MANY_BELOW_SECOND_THRESHOLD',
    params: {
      count,
      threshold: display(secondThreshold),
      max: maxBelowSecondThreshold,
    },
  };
}

const HARD_RULE_CHECKS: readonly ((
  graded: GradedComponent[],
  rules: ApprovalRules,
) => RiskReason | null)[] = [checkComponentMin, checkSecondThreshold];

/**
 * Nota minima de cada componente que falta: o minimo por componente e, se
 * a quota abaixo do limiar secundario ja esta cheia, o proprio limiar.
 */
function remainingComponentFloor(
  graded: GradedComponent[],
  rules: ApprovalRules,
): number {
  const { secondThreshold, maxBelowSecondThreshold } = rules;
  const quotaFull =
    secondThreshold !== null &&
    maxBelowSecondThreshold !== null &&
    countBelow(graded, secondThreshold) >= maxBelowSecondThreshold;
  return Math.max(
    rules.scaleMin,
    rules.componentMinGrade ?? rules.scaleMin,
    quotaFull ? secondThreshold : rules.scaleMin,
  );
}

function toGradedComponents(
  components: RiskComponentInput[],
  weightBase: number,
  rules: ApprovalRules,
): GradedComponent[] {
  const graded: GradedComponent[] = [];
  for (const component of components) {
    const { grade } = component;
    if (grade === null || !Number.isFinite(grade)) continue;
    graded.push({
      label: component.label,
      share: component.weightPct / weightBase,
      grade: clamp(grade, rules.scaleMin, rules.scaleMax),
    });
  }
  return graded;
}

/** null = sem dados para um veredicto (nenhum peso avaliado) ou escala invalida. */
function buildContext(input: CourseRiskInput): CourseContext | null {
  const { rules } = input;
  const span = rules.scaleMax - rules.scaleMin;
  const weighted = input.components.filter(
    (c) => Number.isFinite(c.weightPct) && c.weightPct > 0,
  );
  // Pesos absolutos: o que falta para 100% ainda esta por avaliar (o user
  // pode so ter lancado parte dos componentes). Acima de 100 divide-se pela
  // soma, para nunca passar de 100%.
  const weightBase = Math.max(PERCENT, sum(weighted.map((c) => c.weightPct)));
  if (!(span > 0)) return null;

  const graded = toGradedComponents(weighted, weightBase, rules);
  const gradedShare = sum(graded.map((g) => g.share));
  if (gradedShare <= FLOAT_EPSILON) return null;

  const earned = sum(graded.map((g) => g.grade * g.share));
  const projected = earned / gradedShare;
  const remainingShare = Math.max(0, 1 - gradedShare);
  const settled = remainingShare <= SETTLED_SHARE_TOLERANCE + FLOAT_EPSILON;
  const passRaw = LOWEST_PASSING_RAW[rules.rounding](rules.passMark);
  const rawNeeded = settled ? 0 : (passRaw - earned) / remainingShare;

  return {
    rules,
    span,
    passRaw,
    gradedShare: settled ? 1 : gradedShare,
    settled,
    projected,
    needed: settled
      ? 0
      : Math.max(rawNeeded, remainingComponentFloor(graded, rules)),
    finalPasses:
      applyRounding(projected, rules) >= rules.passMark - FLOAT_EPSILON,
    violations: HARD_RULE_CHECKS.map((check) => check(graded, rules)).filter(
      isPresent,
    ),
  };
}

/** Estado da avaliacao continua; ganha a primeira regra que se aplica. */
const OUTCOME_RULES: readonly {
  outcome: ContinuousOutcome;
  applies: (ctx: CourseContext) => boolean;
}[] = [
  { outcome: 'failed', applies: (ctx) => ctx.violations.length > 0 },
  { outcome: 'passed', applies: (ctx) => ctx.settled && ctx.finalPasses },
  { outcome: 'failed', applies: (ctx) => ctx.settled },
  {
    outcome: 'impossible',
    applies: (ctx) => ctx.needed > ctx.rules.scaleMax + FLOAT_EPSILON,
  },
];
const DEFAULT_OUTCOME: ContinuousOutcome = 'open';

function resolveOutcome(ctx: CourseContext): ContinuousOutcome {
  const match = OUTCOME_RULES.find((rule) => rule.applies(ctx));
  return match ? match.outcome : DEFAULT_OUTCOME;
}

function countSittings(rules: ApprovalRules): number {
  return FALLBACK_TRACKS.filter((t) => t.exists(rules)).length;
}

function fallbackTrack(rules: ApprovalRules): ApprovalTrack {
  const match = FALLBACK_TRACKS.find((t) => t.exists(rules));
  return match ? match.track : NO_FALLBACK_TRACK;
}

function isBelowPass(ctx: CourseContext): boolean {
  return ctx.projected < ctx.passRaw - FLOAT_EPSILON;
}

/** Falta de media mostrada face a passagem (0-1), pesada pelo ja avaliado. */
function weightedShortfall(ctx: CourseContext): number {
  const belowPass = ctx.passRaw - ctx.rules.scaleMin;
  const ratio = belowPass > 0 ? (ctx.passRaw - ctx.projected) / belowPass : 0;
  return clamp(ratio, 0, 1) * ctx.gradedShare;
}

/** Pontos se a continua caisse agora e restasse so a prova unica. */
function fallbackPoints(ctx: CourseContext): number {
  const profile = FALLBACK_BY_SITTINGS[countSittings(ctx.rules)];
  return profile.base + weightedShortfall(ctx) * profile.shortfallMaxPoints;
}

/**
 * Necessario no restante como fracao da escala. Fechada abaixo da passagem
 * nao tem restante que a salve: conta como impossivel.
 */
function neededScaleRatio(ctx: CourseContext): number {
  if (ctx.settled) return ctx.finalPasses ? 0 : Number.POSITIVE_INFINITY;
  return (ctx.needed - ctx.rules.scaleMin) / ctx.span;
}

/** Media mostrada claramente abaixo da passagem (nao so por decimas). */
function isFarBelowPass(ctx: CourseContext): boolean {
  const gap = (ctx.passRaw - ctx.projected) / ctx.span;
  return gap >= SEVERE_MIN_AVERAGE_GAP_RATIO - FLOAT_EPSILON;
}

/**
 * Gravidade pelas notas: 0 se o necessario ainda e realista; senao pontos
 * "extreme" que nenhuma prova unica limita (ver SEVERE_NEED_CURVE).
 */
function severeGradePoints(ctx: CourseContext): number {
  const ratio = neededScaleRatio(ctx);
  if (ratio < SEVERE_NEED_SCALE_RATIO - FLOAT_EPSILON) return SCORE_MIN;
  if (!isFarBelowPass(ctx)) return SCORE_MIN;
  return Math.min(
    SEVERE_MAX_POINTS,
    interpolate(SEVERE_NEED_CURVE, ratio) +
      weightedShortfall(ctx) * SEVERE_SHORTFALL_MAX_POINTS,
  );
}

/** Dificuldade d da media necessaria (ver NEED_DIFFICULTY_CURVE). */
function needDifficulty(ctx: CourseContext): number {
  const { scaleMin, scaleMax } = ctx.rules;
  if (ctx.needed <= ctx.passRaw) {
    const belowPass = ctx.passRaw - scaleMin;
    return belowPass > 0
      ? (ctx.needed - scaleMin) / belowPass
      : DIFFICULTY_AT_PASS;
  }
  const abovePass = scaleMax - ctx.passRaw;
  return abovePass > 0
    ? DIFFICULTY_AT_PASS + (ctx.needed - ctx.passRaw) / abovePass
    : DIFFICULTY_AT_MAX;
}

function performanceGapPoints(ctx: CourseContext): number {
  if (!isBelowPass(ctx)) return 0;
  const gap =
    (ctx.needed - ctx.projected) / (ctx.span * PERFORMANCE_GAP_FULL_SPAN_RATIO);
  return clamp(gap, 0, 1) * ctx.gradedShare * PERFORMANCE_GAP_MAX_POINTS;
}

function remainingReason(
  code: RiskReasonCode,
  ctx: CourseContext,
  impact: number,
): ScoredReason {
  return {
    code,
    params: {
      needed: display(ctx.needed),
      remaining: display((1 - ctx.gradedShare) * PERCENT),
    },
    impact,
  };
}

function lowAverageReason(ctx: CourseContext, impact: number): ScoredReason {
  return {
    code: 'LOW_AVERAGE_SO_FAR',
    params: {
      // So se usa abaixo da passagem: para baixo, nunca "10 abaixo de 10".
      average: displayFloor(ctx.projected),
      passMark: display(ctx.rules.passMark),
    },
    impact,
  };
}

function pickReasons(
  entries: { when: boolean; build: () => ScoredReason }[],
): ScoredReason[] {
  return entries.filter((e) => e.when).map((e) => e.build());
}

function scoreOpenTrack(ctx: CourseContext): CoreScore {
  const needPoints = interpolate(NEED_DIFFICULTY_CURVE, needDifficulty(ctx));
  const gapPoints = performanceGapPoints(ctx);
  const continuousPoints = Math.min(
    OPEN_TRACK_MAX_POINTS,
    needPoints + gapPoints,
  );
  return {
    // Com exame/recurso a seguir, o risco nunca passa o de ir ja a prova,
    // salvo gravidade pelas notas (necessario fora do realista).
    points: Math.max(
      Math.min(continuousPoints, fallbackPoints(ctx)),
      severeGradePoints(ctx),
    ),
    reasons: pickReasons([
      {
        // Arredondado como o score, para um "medium" ter sempre razao.
        when: Math.round(needPoints) >= NEED_REASON_MIN_POINTS,
        build: () => remainingReason('HIGH_NEED_ON_REMAINING', ctx, needPoints),
      },
      {
        when: isBelowPass(ctx),
        build: () => lowAverageReason(ctx, gapPoints),
      },
    ]),
  };
}

/** Continua decidida: o risco e o da prova unica a 100% que resta (ou chumbo). */
function scoreFallbackTrack(
  ctx: CourseContext,
  causes: RiskReason[],
): CoreScore {
  const sittings = countSittings(ctx.rules);
  const profile = FALLBACK_BY_SITTINGS[sittings];
  const shortfallPoints = weightedShortfall(ctx) * profile.shortfallMaxPoints;
  const lowAverageIsCause = causes.some((r) => r.code === 'LOW_AVERAGE_SO_FAR');
  return {
    points: Math.max(profile.base + shortfallPoints, severeGradePoints(ctx)),
    reasons: [
      ...causes.map((r) => ({ ...r, impact: profile.base })),
      ...pickReasons([
        {
          when: sittings > 0,
          build: () => ({
            code: 'ONLY_EXAM_TRACK_LEFT',
            params: { track: fallbackTrack(ctx.rules) },
            impact: profile.base,
          }),
        },
        {
          when: !lowAverageIsCause && isBelowPass(ctx),
          build: () => lowAverageReason(ctx, shortfallPoints),
        },
      ]),
    ],
  };
}

/** Sem regra dura violada, a nota final fechada abaixo da passagem e a causa. */
function failureCauses(ctx: CourseContext): RiskReason[] {
  return ctx.violations.length > 0
    ? ctx.violations
    : [lowAverageReason(ctx, SCORE_MIN)];
}

const CORE_SCORERS: Record<
  ContinuousOutcome,
  (ctx: CourseContext) => CoreScore
> = {
  open: scoreOpenTrack,
  passed: () => ({ points: SCORE_MIN, reasons: [] }),
  failed: (ctx) => scoreFallbackTrack(ctx, failureCauses(ctx)),
  impossible: (ctx) =>
    scoreFallbackTrack(ctx, [
      remainingReason('IMPOSSIBLE_ON_REMAINING', ctx, SCORE_MIN),
    ]),
};

const TRACK_BY_OUTCOME: Record<
  ContinuousOutcome,
  (rules: ApprovalRules) => ApprovalTrack
> = {
  open: () => 'CONTINUOUS',
  passed: () => 'CONTINUOUS',
  failed: fallbackTrack,
  impossible: fallbackTrack,
};

/** neededOnRemaining so faz sentido com a continua ainda em jogo ou impossivel. */
const NEEDED_VISIBLE: Record<ContinuousOutcome, boolean> = {
  open: true,
  impossible: true,
  passed: false,
  failed: false,
};

const keepEverySignal = (): boolean => true;

const SIGNAL_FILTER_BY_OUTCOME: Record<
  ContinuousOutcome,
  (code: RiskReasonCode) => boolean
> = {
  open: keepEverySignal,
  failed: keepEverySignal,
  impossible: keepEverySignal,
  passed: (code) => SIGNALS_RELEVANT_WHEN_PASSED.has(code),
};

function lowStudySignal(input: CourseRiskInput): ScoredReason | null {
  const { studiedMinutes, estimatedMinutes } = input;
  if (studiedMinutes === null || estimatedMinutes === null) return null;
  if (!(estimatedMinutes > 0)) return null;
  const ratio = Math.max(0, studiedMinutes) / estimatedMinutes;
  if (!(ratio < LOW_STUDY_RATIO)) return null;
  return {
    code: 'LOW_STUDY_TIME',
    params: {
      studied: Math.round(studiedMinutes),
      estimated: Math.round(estimatedMinutes),
    },
    impact: (1 - ratio / LOW_STUDY_RATIO) * LOW_STUDY_MAX_POINTS,
  };
}

function absenceSignal(input: CourseRiskInput): ScoredReason | null {
  const { absenceSharePct, absenceLimitPct } = input;
  if (absenceSharePct === null || absenceLimitPct === null) return null;
  if (!(absenceLimitPct > 0)) return null;
  const usage = absenceSharePct / absenceLimitPct;
  const band = ABSENCE_BANDS.find((b) => usage >= b.minUsage - FLOAT_EPSILON);
  if (!band) return null;
  return {
    code: band.code,
    params: {
      share: display(absenceSharePct),
      limit: display(absenceLimitPct),
    },
    impact: band.points,
  };
}

function postponedSignal(input: CourseRiskInput): ScoredReason | null {
  if (!(input.postponedCount >= POSTPONED_MIN_COUNT)) return null;
  return {
    code: 'POSTPONED_TASKS',
    params: { count: input.postponedCount },
    impact:
      Math.min(input.postponedCount, POSTPONED_CAP_COUNT) *
      POSTPONED_POINTS_PER_TASK,
  };
}

const SECONDARY_SIGNALS: readonly ((
  input: CourseRiskInput,
) => ScoredReason | null)[] = [lowStudySignal, absenceSignal, postponedSignal];

/** Fracao 0-1 da escala convertida para a nota da cadeira. */
function toCourseScale(fraction: number, rules: ApprovalRules): number {
  return display(fraction * (rules.scaleMax - rules.scaleMin) + rules.scaleMin);
}

/**
 * Historico com o docente (medias normalizadas 0-1). So conta com amostra
 * suficiente e uma margem clara; o peso escala com o risco que ja existe por
 * outras vias, por isso sozinho nunca muda nada.
 */
function teacherSignal(
  input: CourseRiskInput,
  scoreSoFar: number,
): ScoredReason | null {
  const { teacher, rules } = input;
  if (teacher === null || !(teacher.sampleWithTeacher >= TEACHER_MIN_SAMPLE)) {
    return null;
  }
  const gap = teacher.avgOthers - teacher.avgWithTeacher;
  if (!(gap >= TEACHER_MIN_GAP_RATIO - FLOAT_EPSILON)) return null;
  const strength = clamp(gap / TEACHER_FULL_GAP_RATIO, 0, 1);
  const leverage = clamp(scoreSoFar / TEACHER_FULL_EFFECT_SCORE, 0, 1);
  return {
    code: 'TEACHER_HISTORY_LOWER',
    params: {
      teacher: teacher.name,
      withTeacher: toCourseScale(teacher.avgWithTeacher, rules),
      others: toCourseScale(teacher.avgOthers, rules),
    },
    impact: strength * leverage * TEACHER_MAX_POINTS,
  };
}

/**
 * Risco de chumbo de uma cadeira. null quando nao ha nenhum peso avaliado
 * (os outros sinais sozinhos nao chegam para um veredicto).
 */
export function computeCourseRisk(input: CourseRiskInput): CourseRisk | null {
  const ctx = buildContext(input);
  if (ctx === null) return null;

  const outcome = resolveOutcome(ctx);
  const core = CORE_SCORERS[outcome](ctx);
  const keepSignal = SIGNAL_FILTER_BY_OUTCOME[outcome];

  const secondary = SECONDARY_SIGNALS.map((evaluate) => evaluate(input))
    .filter(isPresent)
    .filter((r) => keepSignal(r.code));
  const scoreSoFar =
    core.points +
    Math.min(SECONDARY_MAX_POINTS, sum(secondary.map((r) => r.impact)));
  const teacher = [teacherSignal(input, scoreSoFar)]
    .filter(isPresent)
    .filter((r) => keepSignal(r.code));

  const score = Math.round(
    clamp(scoreSoFar + sum(teacher.map((r) => r.impact)), SCORE_MIN, SCORE_MAX),
  );
  const reasons = [...core.reasons, ...secondary, ...teacher]
    .sort((a, b) => b.impact - a.impact)
    .map(({ code, params }) => ({ code, params }));
  const gradedWeightPct = display(ctx.gradedShare * PERCENT);

  return {
    areaId: input.areaId,
    areaName: input.areaName,
    colorHex: input.colorHex,
    score,
    level: levelFor(score),
    track: TRACK_BY_OUTCOME[outcome](input.rules),
    reasons,
    currentAverage: display(ctx.projected),
    gradedWeightPct,
    remainingWeightPct: display(PERCENT - gradedWeightPct),
    neededOnRemaining: NEEDED_VISIBLE[outcome] ? display(ctx.needed) : null,
  };
}
