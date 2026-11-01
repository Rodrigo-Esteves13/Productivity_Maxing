// Contrato partilhado do motor de regras de aprovacao e do risco de chumbo
// (N45-N47). Estas formas sao fixas: o motor, o servico, o endpoint e o
// frontend dependem delas. Alterar so com acordo de todos.

export type ApprovalRounding = 'NONE' | 'UP_TO_INTEGER_AT_HALF';

export type ApprovalTrack = 'CONTINUOUS' | 'EXAM' | 'RESIT';

/** Regras de aprovacao em dados, sem nada fixo para uma universidade. */
export interface ApprovalRules {
  presetKey: string | null;
  scaleMin: number;
  scaleMax: number;
  /** Nota final (ja arredondada) a partir da qual se passa. */
  passMark: number;
  /** UP_TO_INTEGER_AT_HALF: 9.5 -> 10, 9.4 -> 9. NONE: sem arredondar. */
  rounding: ApprovalRounding;
  /** Nenhum componente avaliado pode ficar abaixo disto. null = sem regra. */
  componentMinGrade: number | null;
  /** Limiar secundario (ex: 8). null = sem regra. */
  secondThreshold: number | null;
  /** Maximo de componentes abaixo de secondThreshold (ex: 1). */
  maxBelowSecondThreshold: number | null;
  /** Pistas de exame/recurso existentes. Valem 100%, uma so tentativa. */
  hasExamTrack: boolean;
  hasResitTrack: boolean;
}

export interface RiskComponentInput {
  label: string;
  /** Peso em % (0-100). */
  weightPct: number;
  /** null = ainda nao avaliado. */
  grade: number | null;
}

export interface CourseRiskInput {
  areaId: string;
  areaName: string;
  colorHex: string;
  rules: ApprovalRules;
  components: RiskComponentInput[];
  /** Minutos estudados vs estimados (so conta se ambos existirem). */
  studiedMinutes: number | null;
  estimatedMinutes: number | null;
  /** Percentagem de faltas e o limite do user. */
  absenceSharePct: number | null;
  absenceLimitPct: number | null;
  postponedCount: number;
  /** Docente: media do user com este docente vs nas outras cadeiras. */
  teacher: {
    name: string;
    avgWithTeacher: number;
    avgOthers: number;
    sampleWithTeacher: number;
  } | null;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export type RiskReasonCode =
  | 'COMPONENT_BELOW_MIN'
  | 'TOO_MANY_BELOW_SECOND_THRESHOLD'
  | 'IMPOSSIBLE_ON_REMAINING'
  | 'HIGH_NEED_ON_REMAINING'
  | 'LOW_AVERAGE_SO_FAR'
  | 'LOW_STUDY_TIME'
  | 'ABSENCE_NEAR_LIMIT'
  | 'ABSENCE_OVER_LIMIT'
  | 'POSTPONED_TASKS'
  | 'TEACHER_HISTORY_LOWER'
  | 'ONLY_EXAM_TRACK_LEFT'
  | 'REMAINING_UNCERTAINTY'
  | 'REMAINING_UNCERTAINTY_MIN'
  | 'REMAINING_UNCERTAINTY_BASIC';

/** A UI traduz por codigo; params alimentam a interpolacao. */
export interface RiskReason {
  code: RiskReasonCode;
  params: Record<string, string | number>;
}

export interface CourseRisk {
  areaId: string;
  areaName: string;
  colorHex: string;
  /** 0 (sem risco) a 100 (chumbo praticamente certo). */
  score: number;
  level: RiskLevel;
  /** Pista em que o aluno ainda pode passar sem exame; EXAM/RESIT se a continua ja nao chega. */
  track: ApprovalTrack;
  reasons: RiskReason[];
  /** Nota final projetada com o que ha (arredondada), ou null. */
  currentAverage: number | null;
  gradedWeightPct: number;
  remainingWeightPct: number;
  /** Media necessaria no peso restante para atingir passMark, ou null. */
  neededOnRemaining: number | null;
}

/**
 * Funcoes puras do motor (risk-engine.ts), nomes fixos:
 *   applyRounding(value, rules): number
 *   computeCourseRisk(input: CourseRiskInput): CourseRisk | null
 * computeCourseRisk devolve null quando nao ha dados que justifiquem um
 * veredicto (nenhum componente avaliado, sem nada mais).
 *
 * Servico (approval-rules.service.ts):
 *   resolveRulesForArea(userId, areaId): Promise<ApprovalRules>
 *   (override da cadeira > regras do programa > preset generico).
 * Endpoint: GET /course-risk -> CourseRisk[] (ordenado por score desc).
 */
