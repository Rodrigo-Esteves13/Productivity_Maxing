import type { PredictionMethod } from '../prediction/prediction.types';

export interface StudyPlanBlock {
  date: string; // YYYY-MM-DD, hora de Lisboa
  startMinutes: number;
  endMinutes: number;
  // 'task': estudo de uma task. 'review': revisão leve de consolidação de
  // uma cadeira (sem task; taskId é sintético, "review:<areaId>").
  kind: 'task' | 'review';
  taskId: string;
  taskTitle: string;
  areaId: string;
  areaName: string;
  areaColorHex: string;
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
  // Parte de studyMinutes que é revisão de consolidação.
  reviewMinutes: number;
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
  // Dias que o plano cobre nos blocos/dias devolvidos.
  horizonDays: number;
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

export type FocusEffectStatus =
  'not_enough_data' | 'no_variation' | 'inconclusive' | 'clear';

// Efeito de um fator (foco ou interesse) na nota, em pontos da escala por
// cada ponto do fator a mais.
export interface FactorEffect {
  status: FocusEffectStatus;
  // Tasks avaliadas que entraram no calculo.
  sampleSize: number;
  gradePointsPerPoint: number | null;
  // So em 'clear'.
  rangeGradePoints: { low: number; high: number } | null;
}

// Efeito do foco (1 a 5) e do interesse na cadeira (1 a 5) na nota,
// medidos nos dados da propria pessoa.
export interface FocusEffectResult {
  focus: FactorEffect & {
    minSamplesNeeded: number;
    // Tasks avaliadas deixadas de fora por as sessoes nao terem foco.
    excludedUnrated: number;
  };
  interest: FactorEffect & {
    minSamplesNeeded: number;
    minAreasNeeded: number;
    // Cadeiras com tasks avaliadas em que ainda nao deste interesse.
    areasMissingInterest: number;
  };
  // Escala usada nos pontos (a da task avaliada mais recente).
  scale: { min: number; max: number };
}

// Foco medio (1 a 5) e nota media (% da escala) por semana.
export interface FocusTrendWeek {
  weekStart: string;
  avgFocus: number | null;
  ratedMinutes: number;
  avgGradePercent: number | null;
  gradedTasks: number;
}

export interface FocusTrendResult {
  weeks: FocusTrendWeek[];
}

// Uma bolinha por task avaliada: foco medio antes do prazo contra a nota.
export interface FocusScatterPoint {
  taskId: string;
  title: string;
  areaName: string;
  date: string;
  avgFocus: number;
  ratedMinutes: number;
  gradePercent: number;
}

export interface FocusScatterResult {
  points: FocusScatterPoint[];
}
