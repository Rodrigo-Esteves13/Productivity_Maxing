import type { PredictionMethod } from '../prediction/prediction.types';

export interface StudyPlanBlock {
  date: string; // YYYY-MM-DD, hora de Lisboa
  startMinutes: number;
  endMinutes: number;
  taskId: string;
  taskTitle: string;
  // true quando este bloco empurra o dia acima do limite diário.
  isOvertime: boolean;
}

// De onde veio a estimativa usada para uma task.
export type EstimateSource =
  | 'manual' // Task.estimatedMinutes tal como escrito
  | 'manual_calibrated' // manual x fator aprendido do histórico
  | 'predicted' // modelo de PredictionService
  | 'course_history' // média das tuas tasks já feitas nesta cadeira
  | 'default'; // tabela por dificuldade (e se tem peso na nota)

export interface StudyPlanTask {
  taskId: string;
  title: string;
  areaName: string;
  areaColorHex: string;
  deadline: string; // YYYY-MM-DD
  estimateMinutes: number;
  estimateSource: EstimateSource;
  loggedMinutes: number;
  // O que falta estudar: estimativa menos o já registado.
  neededMinutes: number;
  plannedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
}

export interface StudyPlanDay {
  date: string;
  classMinutes: number;
  workMinutes: number;
  studyMinutes: number;
  overtimeMinutes: number;
  freeMinutes: number;
}

export type CapacityStatus = 'no_work' | 'on_track' | 'overtime' | 'short';

export interface StudyPlanSummary {
  status: CapacityStatus;
  neededMinutes: number;
  plannedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  // Soma, por dia, do menor entre tempo livre e o limite diário: quanto
  // estudo cabe sem overtime.
  availableMinutes: number;
  calibrationFactor: number | null;
  predictionMethod: PredictionMethod;
}

export interface StudyPlanResult {
  suggestions: StudyPlanBlock[];
  tasks: StudyPlanTask[];
  days: StudyPlanDay[];
  summary: StudyPlanSummary;
  dailyLimitMinutes: number;
  overtimeExtraMinutes: number;
}

// Dados reais de uma cadeira, para saber quanto tempo costuma pedir.
export interface CourseForecast {
  areaId: string;
  areaName: string;
  areaColorHex: string;
  studiedMinutes: number;
  completedTasks: number;
  // Média do tempo REAL gasto nas tasks já concluídas (null sem histórico).
  avgMinutesPerCompletedTask: number | null;
  // Idem só para tasks com peso na nota (frequências, testes, projetos).
  avgMinutesPerGradedTask: number | null;
  pendingTasks: number;
  // O que ainda falta estudar nas tasks pendentes (mesmas estimativas do plano).
  remainingMinutes: number;
  nextDeadline: string | null;
}

export type GradeProjectionStatus =
  | 'ready' // há tasks pendentes com nota e pelo menos um modelo utilizável
  | 'not_enough_data' // poucas tasks concluídas com nota e tempo registado
  | 'no_clear_link' // há dados, mas o estudo não explica as notas
  | 'nothing_pending'; // sem tasks com nota por fazer

export interface GradeProjectionTask {
  taskId: string;
  title: string;
  areaId: string;
  areaName: string;
  areaColorHex: string;
  deadline: string; // YYYY-MM-DD
  weightPercentage: number;
  // Minutos de estudo em que a projeção se baseia (a estimativa do plano).
  minutesBasis: number;
  // null quando não há modelo utilizável para esta cadeira.
  projectedGrade: number | null;
  rangeGrade: { low: number; high: number } | null;
  // Pontos de nota esperados por cada hora extra de estudo (>= 0).
  gainPerExtraHour: number | null;
  // Minutos de estudo para a nota esperada chegar ao alvo. null sem alvo,
  // sem modelo, ou quando nem com o máximo de estudo o modelo lá chega.
  minutesForTarget: number | null;
  targetGrade: number | null;
  basis: 'course' | 'overall' | null;
  // Com quantas tasks passadas o modelo foi ajustado.
  sampleSize: number;
  // Explicação curta quando projectedGrade é null.
  reason: 'not_enough_data' | 'no_clear_link' | null;
  gradeMin: number;
  gradeMax: number;
}

// Avaliação antiga com nota mas sem tempo de estudo conhecido: o utilizador
// pode escrever, de memória, quanto estudou, para as previsões arrancarem.
export interface BackfillCandidate {
  taskId: string;
  title: string;
  areaName: string;
  areaColorHex: string;
  date: string; // YYYY-MM-DD
  grade: number;
  gradeMax: number;
}

export interface GradeProjectionResult {
  status: GradeProjectionStatus;
  // Tasks concluídas com nota e tempo de estudo (todas as cadeiras).
  trainingSamples: number;
  minSamplesNeeded: number;
  tasks: GradeProjectionTask[];
  backfillCandidates: BackfillCandidate[];
}
