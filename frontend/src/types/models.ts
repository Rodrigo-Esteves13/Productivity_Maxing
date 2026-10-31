// ENUMS
export type Provider = 'GOOGLE' | 'DISCORD' | 'GITHUB';
export type Role = 'USER' | 'ADMIN';
export type ProgressStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'VERY_BEHIND' | 'COMPLETED';
// Quanto trabalho a task da (independente da dificuldade). Ver enum Effort
// no schema.prisma; null = MODERATE.
export type Effort = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'EXHAUSTIVE';
// Quao certa e a data. UNKNOWN/SURPRISE nunca ficam em atraso (a data e so
// um palpite). Ver enum DateCertainty no schema.prisma.
export type DateCertainty = 'EXACT' | 'APPROXIMATE' | 'UNKNOWN' | 'SURPRISE';
// Corpo aceite por POST/PATCH /tasks. Tudo opcional (o PATCH e parcial);
// `null` limpa um campo opcional. Espelha create-task.dto.ts do backend.
export interface TaskWriteInput {
  areaId?: string;
  periodId?: string;
  title?: string;
  date?: string;
  type?: string;
  academicType?: string | null;
  topics?: string | null;
  notes?: string | null;
  referenceLink?: string | null;
  isPinned?: boolean;
  difficulty?: string;
  effort?: Effort | null;
  dateCertainty?: DateCertainty;
  isBlocked?: boolean;
  availableFrom?: string | null;
  // Trabalho em duas fases: dia da entrega (antes da apresentacao em `date`).
  submissionDate?: string | null;
  onTime?: boolean | null;
  submissionOnTime?: boolean | null;
  priority?: string;
  progressStatus?: string;
  weightPercentage?: number | null;
  estimatedMinutes?: number | null;
  recalledStudyMinutes?: number | null;
  targetGrade?: number | null;
  realGrade?: number | null;
  calendarDurationMinutes?: number | null;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceInterval?: number;
  recurrenceUntil?: string | null;
}

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface WeeklyReview {
  from: string;
  to: string;
  completed: { id: string; title: string; areaName: string | null; completedAt: string }[];
  postponed: { id: string; title: string; areaName: string | null; postponedCount: number }[];
  overdueCount: number;
  studyMinutes: number;
  studyByArea: { areaName: string; minutes: number }[];
  focusAverage: number | null;
  upcoming: { id: string; title: string; areaName: string | null; date: string }[];
}

// O que os formularios entregam: o corpo da task + a flag so de UI que
// decide se se sincroniza com o Google Calendar a seguir (nunca vai para a API).
export interface TaskFormSubmission extends TaskWriteInput {
  syncToCalendar: boolean;
  // So de UI (nunca vai no corpo de POST /tasks): titulos da checklist
  // escritos no formulario de criacao, enviados a seguir via /subtasks/bulk.
  subtasks?: string[];
}

// Item de checklist dentro de uma task: so titulo + feito. Sem peso/nota.
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarFeedStatus {
  enabled: boolean;
  token: string | null;
}

export type Difficulty = 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';
// Priority stopped being a fixed union ('LOW'|'MEDIUM'|'HIGH') the moment
// it became an admin-managed catalog (see AdminPriority/PriorityOption
// below) - it's just whatever key the admin's Priority rows use, a plain
// string, same as `type`/`academicType` already were.
export type SecurityEventType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'ADMIN_PAD_DELETED'
  | 'ADMIN_PAD_SOURCE_BLOCKED'
  | 'REFRESH_TOKEN_REUSE';

// Sessao de um dispositivo com login feito (GET /auth/sessions). ipMasked
// ja vem com o fim escondido pelo backend; current = este browser.
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ipMasked: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}
// No longer fixed union types: now they come from the DB (a table the
// admin can edit), so they're `string` (the "key" returned by /tasks/meta).
export type TaskType = string;
export type AcademicTaskType = string;

// Shape returned by /tasks/meta to populate selects
export interface TaskTypeOption {
  key: string;
  label: string;
  colorHex?: string | null;
}

export interface AcademicTaskTypeOption {
  key: string;
  label: string;
  taskTypeKey: string; // which TaskType it belongs to, e.g. "ACADEMIC"
  // Fixed-date event (test, exam): finishing it late never counts as late.
  isEvent?: boolean;
}

export interface TaskMeta {
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  efforts?: string[];
  dateCertainties?: string[];
  priorities: PriorityOption[];
  progressStatuses: string[];
}

// POST /tasks/import request row - see backend's ImportTaskRowDto. Built
// on the frontend by mapping the spreadsheet's Area/Type NAME columns to
// the IDs/keys the backend expects (see utils/parseTaskImportFile.ts).
export interface ImportTaskRow {
  areaId: string;
  periodId?: string;
  title: string;
  date: string;
  type: string;
  academicType?: string;
  topics?: string;
  weightPercentage?: number;
  difficulty?: Difficulty;
  effort?: Effort;
  progressStatus?: ProgressStatus;
  targetGrade?: number;
  realGrade?: number;
}

// POST /tasks/import response.
export interface ImportTaskRowResult {
  row: number;
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface ImportTasksResult {
  created: number;
  failed: number;
  results: ImportTaskRowResult[];
}

// Uma aula concreta, já gravada (GET /schedule). Ver comentário completo
// no model ClassOccurrence do schema.prisma para o "porquê" de não haver
// recorrência/exceções aqui - isto é sempre uma ocorrência real e datada.
export interface ClassOccurrence {
  id: string;
  userId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  subject: string;
  location: string | null;
  professor: string | null;
  externalUid: string;
  // null = por marcar, true = fui, false = faltei (PATCH /schedule/:id/attendance).
  attended?: boolean | null;
  // Aula que nao houve (professor faltou): riscada, sem presenca.
  cancelled?: boolean;
}

// GET /schedule/attendance: uma linha por disciplina, so aulas ate hoje.
// GET /schedule/study-vs-class: estudo por cadeira vs aulas dadas.
export interface StudyVsClassRow {
  areaId: string;
  areaName: string;
  colorHex: string;
  classMinutes: number;
  studyMinutes: number;
  // Study minutes per class minute; null without any class held.
  ratio: number | null;
}

export interface StudyVsClass {
  rows: StudyVsClassRow[];
  unlinkedSubjects: string[];
}

export interface SubjectAttendance {
  subject: string;
  attended: number;
  missed: number;
  unmarked: number;
}

// Uma linha já parseada de um .ics (ver utils/parseIcsSchedule.ts) - é o
// que vai no body de POST /schedule/import.
export interface ImportScheduleRow {
  date: string;
  startMinutes: number;
  endMinutes: number;
  subject: string;
  location?: string;
  professor?: string;
  externalUid: string;
}

export interface ImportScheduleRowResult {
  row: number;
  success: boolean;
  error?: string;
}

export interface ImportScheduleResult {
  imported: number;
  failed: number;
  // Aulas antigas substituidas (apagadas) por este import.
  removed?: number;
  results: ImportScheduleRowResult[];
}

// GET /study-plan response. Mirrors study-plan.types.ts on the backend.
export interface StudyPlanSuggestion {
  date: string;
  startMinutes: number;
  endMinutes: number;
  // 'review': revisao leve de consolidacao de uma cadeira (taskId sintetico,
  // nao e uma task real).
  kind?: 'task' | 'review';
  taskId: string;
  taskTitle: string;
  areaId?: string;
  areaName?: string;
  areaColorHex?: string;
  isOvertime: boolean;
}

export type EstimateSource =
  | 'manual'
  | 'manual_calibrated'
  | 'predicted'
  | 'course_history'
  | 'default';

export interface StudyPlanTask {
  taskId: string;
  title: string;
  areaName: string;
  areaColorHex: string;
  deadline: string;
  estimateMinutes: number;
  estimateSource: EstimateSource;
  loggedMinutes: number;
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
  // Parte de studyMinutes que e revisao de consolidacao.
  reviewMinutes?: number;
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
  availableMinutes: number;
  calibrationFactor: number | null;
  predictionMethod: 'insufficient_data' | 'linear_regression' | 'mlp';
}

export interface StudyPlanResult {
  suggestions: StudyPlanSuggestion[];
  tasks: StudyPlanTask[];
  days: StudyPlanDay[];
  summary: StudyPlanSummary;
  dailyLimitMinutes: number;
  overtimeExtraMinutes: number;
}

// A stored work shift (GET /work-shifts). Exactly one of dayOfWeek (weekly)
// or date (one-off) is set.
export interface WorkShift {
  id: string;
  dayOfWeek: number | null;
  date: string | null;
  // So semanais: primeiro dia em que o turno conta. null = desde sempre.
  startsOn: string | null;
  startMinutes: number;
  endMinutes: number;
  commitmentId: string | null;
  // Já resolvidos no servidor: nome e deslocação do local, quando existe.
  bufferMinutes: number;
  label: string | null;
  // Morada (do local ou do evento pontual) e meio de transporte.
  address: string | null;
  commuteMode: CommuteMode | null;
}

// Um local/compromisso (ex: um trabalho) com a sua deslocação própria.
export interface Commitment {
  id: string;
  name: string;
  commuteMinutes: number;
  // Morada do local e meio de transporte usados para calcular o trajeto a partir de casa.
  address: string | null;
  commuteMode: CommuteMode;
  // Folgas fixas: dias da semana (0=Dom..6=Sab) em que nunca se trabalha aqui.
  daysOff: number[];
  // Trabalho: tipo de contrato (null = nao e trabalho / nao dito) e ultimo
  // dia (ISO, meia-noite UTC). Depois dele os turnos semanais acabam.
  contractType: ContractType | null;
  endsOn: string | null;
  // false = nos feriados nacionais os turnos semanais daqui desaparecem.
  worksOnHolidays: boolean;
}

export type ContractType = 'PERMANENT' | 'FIXED_TERM' | 'INTERNSHIP';

export interface CommitmentWithShifts extends Commitment {
  shifts: WorkShift[];
}

export interface CommitmentsOverview {
  commitments: CommitmentWithShifts[];
  ungroupedShifts: WorkShift[];
}

export interface UpdateWorkShiftInput {
  dayOfWeek?: number;
  date?: string;
  startsOn?: string | null;
  startMinutes?: number;
  endMinutes?: number;
  commitmentId?: string | null;
}

export type CopyWeekMode = 'one-off' | 'fixed';

export interface CopyWeekInput {
  fromWeekStart: string;
  toWeekStart?: string;
  mode: CopyWeekMode;
}

export interface CopyWeekResult {
  created: WorkShift[];
  skipped: number;
  // Saltados por cairem numa folga fixa do local.
  dayOffSkipped?: number;
  sourceCount: number;
}

// GET /study-plan/grade-projection: nota prevista a partir do tempo de estudo.
export type GradeProjectionStatus = 'ready' | 'not_enough_data' | 'no_clear_link' | 'nothing_pending';

export interface GradeProjectionTask {
  taskId: string;
  title: string;
  areaId: string;
  areaName: string;
  areaColorHex: string;
  deadline: string;
  weightPercentage: number;
  minutesBasis: number;
  projectedGrade: number | null;
  rangeGrade: { low: number; high: number } | null;
  gainPerExtraHour: number | null;
  minutesForTarget: number | null;
  targetGrade: number | null;
  basis: 'course' | 'overall' | null;
  sampleSize: number;
  reason: 'not_enough_data' | 'no_clear_link' | null;
  gradeMin: number;
  gradeMax: number;
}

export interface BackfillCandidate {
  taskId: string;
  title: string;
  areaName: string;
  areaColorHex: string;
  date: string;
  grade: number;
  gradeMax: number;
}

// GET /study-plan/plan-scenario - cartao "If all goes according to plan".
export interface PlanScenarioFill {
  label: string;
  kind: 'component' | 'task';
  weightPercentage: number;
  grade: number;
  source: 'course_median' | 'period_median';
}

export interface PlanScenarioCourse {
  areaId: string;
  areaName: string;
  areaColorHex: string;
  currentAverage: number | null;
  projectedFinal: number | null;
  planFinal: number | null;
  delta: number | null;
  plannedWeight: number;
  missingWeight: number;
  fills: PlanScenarioFill[];
}

export interface PlanScenario {
  gradeMin: number;
  gradeMax: number;
  passThreshold: number;
  courses: PlanScenarioCourse[];
}

export interface GradeProjection {
  status: GradeProjectionStatus;
  trainingSamples: number;
  minSamplesNeeded: number;
  tasks: GradeProjectionTask[];
  backfillCandidates: BackfillCandidate[];
}

// GET /study-plan/courses: dados reais por cadeira.
export interface CourseForecast {
  areaId: string;
  areaName: string;
  areaColorHex: string;
  studiedMinutes: number;
  completedTasks: number;
  avgMinutesPerCompletedTask: number | null;
  avgMinutesPerGradedTask: number | null;
  pendingTasks: number;
  remainingMinutes: number;
  nextDeadline: string | null;
}

// A shift expanded to a concrete day (GET /work-shifts/range).
export interface WorkShiftOccurrence {
  shiftId: string;
  commitmentId: string | null;
  date: string;
  startMinutes: number;
  endMinutes: number;
  bufferMinutes: number;
  label: string | null;
  isRecurring: boolean;
  // Excecao que mudou este dia (para a desfazer); turno noutra hora so
  // nesse dia; e, com withSkipped, o motivo de nao acontecer.
  exceptionId?: string | null;
  retimed?: boolean;
  skipped?: ShiftSkipReason | null;
}

export type ShiftSkipReason = 'OFF' | 'HOLIDAY';
export type ScheduleExceptionKind = 'OFF' | 'RETIME';

// GET /schedule-exceptions: folgas, ferias e mudancas de hora do horario
// semanal entre dois dias (inclusive).
export interface ScheduleException {
  id: string;
  kind: ScheduleExceptionKind;
  shiftId: string | null;
  commitmentId: string | null;
  startsOn: string;
  endsOn: string;
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

export interface CreateScheduleExceptionInput {
  kind: ScheduleExceptionKind;
  shiftId?: string;
  commitmentId?: string;
  /** YYYY-MM-DD */
  startsOn: string;
  endsOn: string;
  startMinutes?: number;
  endMinutes?: number;
  note?: string;
}

export interface CreateWorkShiftInput {
  commitmentId?: string;
  dayOfWeek?: number;
  date?: string;
  startsOn?: string;
  startMinutes: number;
  endMinutes: number;
  bufferMinutes?: number;
  label?: string;
  address?: string;
  commuteMode?: CommuteMode;
}

// Full records used only by the admin area (/admin/task-types,
// /admin/academic-task-types) - distinct from the *Option types above
// (those are the "trimmed down" version for populating selects, coming
// from /tasks/meta). Note: there's no editable "key" here on purpose -
// it's auto-generated by the backend from the label and never exposed for
// editing (only the label, color, order, and active/inactive state are).
export interface AdminTaskType {
  id: string;
  key: string;
  label: string;
  colorHex: string | null;
  order: number;
  isActive: boolean;
  academicTaskTypes: { id: string; key: string; label: string; isActive: boolean }[];
}

export interface AdminAcademicTaskType {
  id: string;
  key: string;
  label: string;
  order: number;
  isActive: boolean;
  isEvent: boolean;
  taskTypeId: string;
  taskType: { id: string; key: string; label: string; colorHex: string | null } | null;
}

export interface AdminPriority {
  id: string;
  key: string;
  label: string;
  colorHex: string | null;
  order: number;
  isActive: boolean;
}

// Shape returned in TaskMeta.priorities (see /tasks/meta) - same trimmed
// "for populating selects" shape as TaskTypeOption, now that Priority is
// a real admin-managed catalog instead of a fixed enum.
export interface PriorityOption {
  key: string;
  label: string;
  colorHex: string | null;
}

// 
// MODELS
// 

// Bate certo com o enum CommuteMode do schema.prisma e com os valores
// aceites pela Google Distance Matrix API (em minúsculas no pedido - ver
// ScheduleService.estimateCommute).
export type CommuteMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  // true if the account already has a password credential (via Supabase
  // Auth) - false for accounts that only ever signed in via OAuth. Never
  // exposes supabaseAuthId itself, only this boolean.
  hasPassword: boolean;
  // false so quando o backend exige verificacao de email e esta conta
  // (email+password) ainda nao confirmou. Opcional: respostas de admin nao o trazem.
  emailVerified?: boolean;
  // Preferencias (Profile > Preferences).
  deadlineEmailReminders?: boolean;
  deadlinePushReminders?: boolean;
  spacedReviewsEnabled?: boolean;
  // Entradas novas do Notebook nascem escondidas dos amigos.
  notesPrivateByDefault?: boolean;
  // 2FA: available = flag do backend (false => esconder tudo); enabled = esta conta tem 2FA.
  twoFactorAvailable?: boolean;
  twoFactorEnabled?: boolean;

  // Só vem preenchido nas respostas de admin (GET/PATCH /users, /users/:id)
  // - ver USER_ADMIN_SELECT em users.service.ts. Opcional aqui porque
  // /auth/me (o "eu" da app, ver AuthContext) não os devolve.
  status?: UserStatus;
  suspendedUntil?: string | null;
  statusReason?: string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedBy?: { id: string; name: string | null; email: string } | null;
  // Codigo de amigo (null = ainda nao abriu o Social).
  friendCode?: string | null;

  // Active dashboard (selected Program + Period) - null while
  // AcademicContext hasn't resolved/created the default "General" yet.
  activeProgramId: string | null;
  activePeriodId: string | null;

  // Horário/plano de estudo (Fase 6) - todos opcionais, null = nunca
  // configurado. Ver CommuteSettingsCard.tsx e Schedule.tsx.
  commuteMinutes: number | null;
  // Nem todo o estudante tem carro - ver comentário completo em
  // CommuteMode no schema.prisma. Sempre definido (tem @default no
  // schema), nunca null.
  commuteMode: CommuteMode;
  homeAddress: string | null;
  campusAddress: string | null;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;

  // Optional relations (depends on what your backend returns)
  areas?: Area[];
  tasks?: Task[];
}

export type AppealResolution = 'APPROVED' | 'DENIED';

export interface AppealSummary {
  id: string;
  createdAt: string;
  resolution: AppealResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

// GET /account-status/me - alimenta o AccountBlockedPage.
export interface AppealAvailability {
  appealsUsed: number;
  maxAppeals: number;
  nextAppealAllowedAt: string | null;
  appealsExhausted: boolean;
}

export interface AccountStatusInfo {
  status: UserStatus;
  suspendedUntil: string | null;
  statusReason: string | null;
  statusUpdatedAt: string | null;
  appeal: AppealSummary | null;
  // null para contas ACTIVE - ver AccountStatusController.getMyStatus.
  appealAvailability: AppealAvailability | null;
}

// Vista de admin (GET /appeals) - além de tudo o que AppealSummary já
// tem, inclui quem submeteu e quem resolveu.
export interface AppealAdmin extends AppealSummary {
  message: string;
  statusAtSubmission: UserStatus;
  reasonAtSubmission: string | null;
  user: { id: string; name: string | null; email: string };
  resolvedBy: { id: string; name: string | null; email: string } | null;
}

// GET /appeals - mesma forma paginada que PaginatedSecurityLogs.
export interface PaginatedAppeals {
  total: number;
  skip: number;
  take: number;
  appeals: AppealAdmin[];
}



export interface AcademicProgram {
  id: string;
  userId: string;
  name: string;
  gradeScale: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  // Default for whether each subject's final grade is rounded to the
  // nearest whole number before the credit-weighted average is computed.
  // Periods can override this individually (see AcademicPeriod.roundFinalGrade).
  roundFinalGrade: boolean;
}

export interface AcademicPeriod {
  id: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  // When true, this is the period its program auto-selects on switch/reload
  // instead of the chronologically most recent one - see togglePeriodPin.
  isPinned: boolean;
  createdAt: string;
  // Overrides AcademicProgram.roundFinalGrade for this period. null = inherit
  // the program's default.
  roundFinalGrade: boolean | null;
}

// Returned by GET /periods/:id/average and GET /programs/:id/average.
// average === null when there isn't any graded task yet (realGrade set) -
// distinct from 0, which would be a real (very bad) average.
export interface WeightedAverage {
  average: number | null;
  gradedTaskCount: number;
  // Sum of the weights (credits, at the program/period level) actually
  // used to compute `average` - used by the dashboard credit simulator to
  // project "what if I add one more graded item" client-side.
  totalWeight: number;
}

export interface PeriodAverage extends WeightedAverage {
  periodId: string;
  periodName: string;
}

export interface ProgramAverage extends WeightedAverage {
  programId: string;
  programName: string;
}

// Returned by GET /programs/:id/periods-comparison - one item per period
// of the program, ordered by startDate asc.
export interface PeriodComparisonEntry extends WeightedAverage {
  periodId: string;
  periodName: string;
  startDate: string;
  isArchived: boolean;
}

// Returned by GET /programs/:id/credits.
export interface CreditsAreaSummary {
  areaId: string;
  areaName: string;
  credits: number | null;
  average: number | null;
  passed: boolean;
}

export interface CreditsSummary {
  programId: string;
  programName: string;
  gradeScale: string;
  passThreshold: number;
  earnedCredits: number;
  attemptedCredits: number;
  areas: CreditsAreaSummary[];
}

// Returned by GET /periods/:id/report-card (printable report card page).
export interface PeriodReportCard extends Omit<CreditsSummary, 'areas'> {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string | null;
  average: number | null;
  gradedTaskCount: number;
  areas: CreditsAreaSummary[];
}

export interface Area {
  id: string;
  userId: string;
  name: string;
  colorHex: string;
  // Key of the TaskType this Area defaults to (null = no type associated).
  defaultTaskType: string | null;
  // Credits (ECTS or equivalent) for this course. null = no credits set
  // (e.g. secondary school) - enters with weight 1 in the average calculation.
  credits: number | null;
  // Só vem preenchido quando GET /areas foi chamado com um periodId
  // concreto - nunca usado para esconder a Area, só para agrupar/ordenar
  // no seletor do Notebook (ver NotebookSubjectPicker).
  usedInPeriod?: boolean;
  // Oficial (catálogo do admin) vs pessoal (só tua). isMine = pessoal e tua.
  isOfficial: boolean;
  isMine: boolean;
  // Área oficial que o utilizador desligou (só relevante para oficiais).
  isHidden?: boolean;
  // Pedido para a área pessoal passar a oficial.
  proposalStatus: AreaProposalStatus;
  proposedAt?: string | null;
  // Motivo da recusa dado pelo admin (só vem preenchido ao dono).
  proposalReviewNote?: string | null;
}

export type AreaProposalStatus = 'NONE' | 'PENDING' | 'REJECTED';

// GET /areas/proposals (admin).
export interface AreaProposal {
  id: string;
  name: string;
  colorHex: string;
  credits: number | null;
  defaultTaskType: string | null;
  proposedAt: string;
  proposedBy: string | null;
}

export interface Task {
  id: string;
  userId: string;
  areaId: string;
  title: string;
  date: string; // ISO String format from backend

  // Which period (semester/academic year) this task belongs to.
  periodId: string;
  
  // Typology
  type: TaskType;
  academicType: AcademicTaskType | null;
  // True when the academic type is a fixed-date event (test, exam).
  academicTypeIsEvent?: boolean;
  topics: string | null;
  notes: string | null;
  isPinned: boolean;
  // Manual drag-and-drop order in TaskGrid - lower first. Set via
  // PATCH /tasks/reorder (reorderTasks in userService.ts).
  sortOrder: number;

  // Execution Metadata
  weightPercentage: number | null;
  difficulty: Difficulty;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  // Ainda nao da para comecar: bloqueada sem data, ou abre em availableFrom.
  isBlocked: boolean;
  availableFrom: string | null;
  // Trabalho em duas fases: entrega neste dia, apresentacao em `date`.
  submissionDate?: string | null;
  // Resposta a "acabaste a tempo?" ao concluir fora do prazo (ganha ao
  // calculo por completedAt); a mesma para a entrega. null = nao respondeu.
  onTime?: boolean | null;
  submissionOnTime?: boolean | null;
  // Nullable, ao contrário de difficulty - ver comentário em priorityId no
  // schema.prisma (opcional de propósito). priorityLabel/priorityColorHex
  // vêm prontos do backend (toResponse) para as badges não precisarem de
  // cruzar com a lista de /tasks/meta só para mostrar um texto e uma cor.
  priority: string | null;
  priorityLabel: string | null;
  priorityColorHex: string | null;
  // Ordem de /admin/priorities (menor = mais prioritário), null sem
  // prioridade - só usado pelo modo de ordenação "Priority" em Tasks.tsx.
  priorityOrder: number | null;
  // Histórico, nunca decresce - ver comentário em schema.prisma. Conta
  // qualquer vez que a data mudou para mais tarde, não só o botão rápido
  // "+1 Day".
  postponedCount: number;
  progressStatus: ProgressStatus;
  referenceLink: string | null;
  // How long you expect this task to take, in minutes. Manual estimate -
  // see api/predictionService.ts for the model-generated suggestion.
  estimatedMinutes: number | null;
  // Tempo de estudo aproximado escrito de memoria (tasks antigas, sem sessoes).
  recalledStudyMinutes?: number | null;
  
  // Evaluation
  targetGrade: number | null;
  realGrade: number | null;
  
  // Integrations & Timestamps
  googleCalendarEventId: string | null;
  // Duration (minutes) of the Google Calendar event, only relevant when
  // the task has a time set. Null = backend defaults to 60min.
  calendarDurationMinutes: number | null;
  createdAt: string;
  // Prisma @updatedAt - touched on every update(), not just user-visible
  // fields. Feeds StaleTasksCard.tsx ("pending, untouched in a while").
  updatedAt: string;
  completedAt: string | null; // Actual moment it moved to COMPLETED
  lastOverdueCheckAt: string | null; // Last time the overdue check-in asked about this task

  // Checklist da task (vem ordenada do backend).
  subtasks?: Subtask[];

  // Recorrencia: ao concluir cria-se a proxima ocorrencia.
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceInterval?: number;
  recurrenceUntil?: string | null;
  // Revisao espacada: id da task que a originou.
  spacedReviewOfTaskId?: string | null;
  // So na resposta de PATCH /tasks/:id quando concluir criou tasks novas
  // (proxima ocorrencia / revisoes espacadas).
  spawnedTasks?: Task[];

  // Optional relations
  area?: Area;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
}

// Only ADMIN if the key was explicitly created with that scope by an
// admin user - see backend AuthService.generateApiKey(), which refuses
// to honor a requested ADMIN scope from anyone whose own Role isn't
// already ADMIN.
export type ApiKeyScope = 'TASKS' | 'ADMIN';

// What GET /auth/api-keys actually returns - never includes keyHash or
// userId, just enough for the user to recognize and manage their keys.
export interface ApiKeySummary {
  id: string;
  name: string;
  scope: ApiKeyScope;
  createdAt: string;
  lastUsed: string | null;
}

export interface Identity {
  id: string;
  userId: string;
  provider: Provider;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
  createdAt: string;
}

export interface SecurityLog {
  id: string;
  type: SecurityEventType;
  ip: string;
  method: string;
  path: string;
  userAgent: string | null;
  // Quantos pedidos bloqueados esta linha agrega (LoggingThrottlerGuard).
  count: number;
  createdAt: string;
  userId: string | null;
  user: { id: string; email: string; name: string | null } | null;
}

export interface PaginatedSecurityLogs {
  total: number;
  skip: number;
  take: number;
  logs: SecurityLog[];
}

export interface SecurityLogsStats {
  totalLastHour: number;
  totalLast24h: number;
  topOffenders: { ip: string; count: number }[];
}

export interface BannedIp {
  id: string;
  ip: string;
  reason: string | null;
  createdAt: string;
  bannedByUserId: string | null;
  bannedBy: { id: string; name: string | null; email: string } | null;
}

// FOCUS / STUDY SESSIONS

export interface StudySession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
  taskId: string | null;
  areaId: string | null;
  task: { id: string; title: string } | null;
  area: { id: string; name: string; colorHex: string } | null;
  // null while the session is active (endedAt doesn't exist yet)
  durationSeconds: number | null;
  // 1 (dispersa) a 5 (totalmente focada); null se nao respondeste.
  focusRating: number | null;
  // Sessao escrita depois, nao cronometrada.
  isManual: boolean;
  // Vezes que carregaste em "Got distracted" durante a sessao.
  distractionCount?: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  hourBucket: number; // 0 (00h-04h) - 5 (20h-24h)
  totalMinutes: number;
  sessionCount: number;
}
export type AgentTriggerMode = 'ANY' | 'ALL';
export type AgentFailMode = 'CLOSED' | 'OPEN';

export interface AgentConfig {
  triggerMode: AgentTriggerMode;
  hasOverdueTasks: boolean;
  hasOverdueCheckins: boolean;
  minDifficultyToday: Difficulty | null;
  anyTaskToday: boolean;
  // Bloqueia enquanto ha uma sessao de Focus a decorrer.
  blockDuringFocus: boolean;
  minProgressStatus: ProgressStatus | null;
  blockedProcesses: string[];
  blockedDomains: string[];
  failMode: AgentFailMode;
  pollIntervalSeconds: number;
  isConfigured: boolean;
}
// --- Notebook ---------------------------------------------------------

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

// Um traço vetorial completo - ver comentário em NotebookEntry.drawingStrokes
// no schema.prisma para o "porquê" de não guardar um PNG rasterizado.
export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

// Uma tabela estruturada dentro de uma entrada - ver comentário em
// NotebookEntry.tables no schema.prisma. `id` é só para servir de
// key/referência local ao editar; gerado no frontend, o backend guarda-o
// tal como vem.
export interface NotebookTable {
  id: string;
  rows: string[][];
}

// Uma etiqueta de texto solta no canvas (não presa a nenhuma forma) -
// para escrever palavras/frases com o teclado por cima do desenho à
// mão, em vez de só símbolos/formas. x/y são o canto superior esquerdo,
// nas mesmas coordenadas fixas do viewBox (ver VIEW_WIDTH/VIEW_HEIGHT em
// NotebookCanvas.tsx). fontSize/color são opcionais no que vem da API
// (entradas antigas não os têm) - o frontend aplica um default ao ler.
export interface CanvasTextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: string;
}

// Ícone posicionável no canvas - ver comentário em
// NotebookEntry.canvasShapes no schema.prisma. x/y/width/height nas
// mesmas coordenadas fixas do viewBox do canvas (ver VIEW_WIDTH/
// VIEW_HEIGHT em NotebookCanvas.tsx), não em pixels de ecrã.
export type CanvasShapeType = 'router' | 'switch' | 'firewall' | 'server' | 'pc' | 'cloud' | 'ap';

export interface CanvasShape {
  id: string;
  type: CanvasShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

// Uma ligação entre duas formas - recalculada a cada render a partir da
// posição atual de fromShapeId/toShapeId (ver clipPointToRectEdge em
// canvasGeometry.ts), por isso "segue" a forma quando é arrastada, sem
// guardar coordenadas próprias. Se uma forma referenciada for apagada, a
// ligação fica órfã e deixa de ser desenhada (ver NotebookCanvas.tsx) -
// na prática nunca acontece porque apagar uma forma apaga também as suas
// ligações (removeLinksForShape).
export interface CanvasLink {
  id: string;
  fromShapeId: string;
  toShapeId: string;
  label: string;
}

export interface NotebookPhoto {
  id: string;
  notebookEntryId: string;
  storagePath: string;
  position: number;
  // Signed URL gerado pelo backend a cada leitura, expira sozinho - nunca
  // guardar isto entre navegações.
  url: string | null;
}

// Ficheiro geral anexado a uma entrada (PDF, DOCX/PPTX/XLSX, ZIP,
// código/texto) - ver comentário em NotebookAttachment no schema.prisma.
// originalFileName é o nome tal como foi enviado, para mostrar/descarregar;
// extension é o tipo real validado no backend (pode não bater certo com a
// extensão do originalFileName, se o utilizador tiver enviado um ficheiro
// mal nomeado).
export interface NotebookAttachment {
  id: string;
  notebookEntryId: string;
  storagePath: string;
  originalFileName: string;
  extension: string;
  sizeBytes: number;
  // Signed URL com download forçado, gerado pelo backend a cada leitura.
  url: string | null;
}

// Um link guardado à parte do textContent - ver comentário em
// NotebookEntry.usefulLinks no schema.prisma.
export interface UsefulLink {
  id: string;
  label: string;
  url: string;
}

export type NotebookEntryType = 'NOTE' | 'STUDY' | 'CLASS';

export interface NotebookEntry {
  id: string;
  userId: string;
  areaId: string;
  classOccurrenceId: string | null;
  title: string;
  entryType: NotebookEntryType;
  // Só tem significado quando entryType é 'CLASS' - ver comentário no
  // schema.prisma sobre porque não é derivado do título.
  classNumber: number | null;
  textContent: string | null;
  drawingStrokes: Stroke[] | null;
  tables: NotebookTable[] | null;
  canvasShapes: CanvasShape[] | null;
  canvasLinks: CanvasLink[] | null;
  canvasTexts: CanvasTextItem[] | null;
  usefulLinks: UsefulLink[] | null;
  // Altura do viewBox do whiteboard (largura fica sempre fixa em 800) -
  // null/undefined = usa o default (ver DEFAULT_CANVAS_HEIGHT em
  // NotebookCanvas.tsx). Extensível pelo botão "Add more space", em vez
  // de suportar várias boards por entrada (mais simples, resolve o mesmo
  // problema de "ficar sem espaço").
  canvasHeight: number | null;
  date: string;
  // Escondida dos amigos com acesso as notas desta cadeira.
  privateFromFriends?: boolean;
  photos: NotebookPhoto[];
  attachments: NotebookAttachment[];
  // Versao (Prisma @updatedAt): vai como baseUpdatedAt ao gravar.
  updatedAt?: string;
}

// Linha da lista de uma cadeira (GET /notebook/entry-summaries): sem o
// conteudo, que vem a pedido (GET /notebook/entries/:id) quando a entrada e
// aberta. Uma aula desenhada sao ~80 KB de JSON que a lista nunca mostrava.
export interface NotebookEntrySummary {
  id: string;
  areaId: string;
  title: string;
  entryType: NotebookEntryType;
  classNumber: number | null;
  date: string;
  // Inicio do texto (ate 400 caracteres, ainda com markdown).
  preview: string | null;
  photoCount: number;
  attachmentCount: number;
}

export interface NotebookSearchResult extends NotebookEntry {
  area: { id: string; name: string; colorHex: string };
}

// Forma pública devolvida por GET /notebook/shared/:token - de propósito
// mais pequena que NotebookEntry (sem id/userId/areaId/classOccurrenceId
// internos), ver NotebookService.getSharedEntry no backend.
export interface SharedNotebookEntry {
  title: string;
  entryType: NotebookEntryType;
  classNumber: number | null;
  textContent: string | null;
  drawingStrokes: Stroke[] | null;
  tables: NotebookTable[] | null;
  canvasShapes: CanvasShape[] | null;
  canvasLinks: CanvasLink[] | null;
  canvasTexts: CanvasTextItem[] | null;
  canvasHeight: number | null;
  usefulLinks: UsefulLink[] | null;
  date: string;
  // Versao lida: o co-owner grava sobre ela (409 se o dono mudou entretanto).
  updatedAt?: string;
  area: { name: string; colorHex: string };
  photos: NotebookPhoto[];
  attachments: NotebookAttachment[];
}

export type NotebookShareVisibility = 'PUBLIC' | 'AUTHORIZED';

// Mirrors ShareAccessRequestStatus in the backend schema.
export type ShareAccessRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

// Papel dado pelo dono ao aprovar: VIEWER le, EDITOR propoe alteracoes que o
// dono aprova/recusa, CO_OWNER edita direto. OWNER so aparece em SharedRole.
export type ShareAccessRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';
export type SharedRole = ShareAccessRole | 'OWNER';

export interface ShareAccessRequest {
  id: string;
  status: ShareAccessRequestStatus;
  accessRole: ShareAccessRole;
  // true = convite do dono a um amigo (PENDING = a espera do convidado).
  invitedByOwner: boolean;
  createdAt: string;
  decidedAt: string | null;
  requestingUser: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

// GET /notebook/entries/:id/share/visits (só o dono).
export interface ShareVisitViewer {
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
  count: number;
  firstVisitAt: string;
  lastVisitAt: string;
}
export interface ShareVisits {
  totalVisits: number;
  uniqueVisitors: number;
  viewers: ShareVisitViewer[];
}

export type FeedbackCategory = 'BUG' | 'IDEA' | 'TRANSLATION' | 'CONFUSING' | 'OTHER';

// Como um feedback fechado acabou (null enquanto aberto).
export type FeedbackResolution = 'DONE' | 'REJECTED';

export interface FeedbackAuthor {
  id: string;
  name: string | null;
  email: string;
  status: UserStatus;
  // Com valor, o user nao pode enviar feedback (bloqueado so aqui).
  feedbackMutedAt: string | null;
}

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  language: string;
  page: string | null;
  createdAt: string;
  isResolved: boolean;
  resolution: FeedbackResolution | null;
  adminReply: string | null;
  repliedAt: string | null;
  // null quando a conta foi apagada.
  user: FeedbackAuthor | null;
}

// O que o autor ve do seu proprio feedback (GET /feedback/mine).
export type MyFeedbackItem = Pick<
  FeedbackItem,
  'id' | 'category' | 'message' | 'createdAt' | 'isResolved' | 'resolution' | 'adminReply' | 'repliedAt'
>;

// Mirrors SharedEntryResult in the backend's notebook.service.ts - a
// visitor to /shared/:token can be in one of 5 states, not just
// "here's the content or a 404". Only 'ok' carries the actual entry.
// Para navegar a partir de uma nota partilhada: o dono recebe o id da nota
// ("Abrir no caderno"); um amigo do dono recebe quem partilhou.
export interface SharedEntryContext {
  ownEntryId: string | null;
  owner: { userId: string; name: string | null; avatarUrl: string | null } | null;
}

export type SharedEntryResult =
  | {
      status: 'ok';
      entry: SharedNotebookEntry;
      role: SharedRole;
      hasPendingProposal: boolean;
      context: SharedEntryContext;
    }
  | { status: 'login_required' }
  | { status: 'not_requested' }
  | { status: 'pending' }
  | { status: 'invited'; requestId: string }
  | { status: 'denied' };

export interface ScheduleLinkResult {
  scheduleSubject: string | null;
}

export interface DetectClassResult {
  occurrence: ClassOccurrence | null;
  // true quando a aula foi encontrada pelo nome da cadeira (ainda sem
  // ligacao ao horario): o cliente deve gravar a ligacao por POST.
  matchedByName?: boolean;
}

// Componentes de nota que nao sao tasks (seminarios semanais, participacao,
// comportamento...). A `grade` ja vem agregada do servidor.
export type GradeAggregation = 'AVERAGE' | 'BEST_OF' | 'DROP_LOWEST';

export interface GradeEntry {
  id: string;
  label: string | null;
  grade: number;
  date: string | null;
}

export interface GradeComponent {
  id: string;
  areaId: string;
  periodId: string;
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregation;
  bestOfCount: number | null;
  expectedEntries: number | null;
  grade: number | null;
  entries: GradeEntry[];
}

export interface GradeComponentInput {
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregation;
  bestOfCount?: number;
  expectedEntries?: number | null;
}

// Alteracao proposta por um EDITOR a uma entrada partilhada (so texto).
export interface ChangeProposalFields {
  title?: string;
  textContent?: string;
  usefulLinks?: UsefulLink[];
}

export interface ChangeProposal {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  payload: ChangeProposalFields;
  createdAt: string;
  proposedBy: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

export type FocusEffectStatus = 'not_enough_data' | 'no_variation' | 'inconclusive' | 'clear';

// Efeito de um fator (foco ou interesse) na nota, em pontos da escala por
// cada ponto do fator a mais.
export interface FactorEffect {
  status: FocusEffectStatus;
  sampleSize: number;
  gradePointsPerPoint: number | null;
  rangeGradePoints: { low: number; high: number } | null;
}

export interface FocusEffect {
  focus: FactorEffect & { minSamplesNeeded: number; excludedUnrated: number };
  interest: FactorEffect & { minSamplesNeeded: number; minAreasNeeded: number; areasMissingInterest: number };
  scale: { min: number; max: number };
}

// Foco medio (1 a 5) e nota media (% da escala) de uma semana.
export interface FocusTrendWeek {
  weekStart: string;
  avgFocus: number | null;
  ratedMinutes: number;
  avgGradePercent: number | null;
  gradedTasks: number;
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

// Bem-estar (Fase 7): registo diario do humor e medicacao.
export interface MoodLog {
  date: string; // YYYY-MM-DD
  mood: number;
  energy: number | null;
  stress: number | null;
  note: string | null;
}

export interface UpsertMoodInput {
  mood: number;
  energy?: number;
  stress?: number;
  note?: string;
}

// DAILY = horas fixas com lembrete; AS_NEEDED = "se necessario", registado
// por toma. Espelha os enums do Prisma.
export type MedicationSchedule = 'DAILY' | 'AS_NEEDED';

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  schedule: MedicationSchedule;
  // Minutos desde a meia-noite de cada toma diaria (vazio em AS_NEEDED).
  times: number[];
  remindersEnabled: boolean;
  active: boolean;
}

export interface MedicationInput {
  name: string;
  dosage?: string;
  schedule?: MedicationSchedule;
  times: number[];
  remindersEnabled?: boolean;
}

// Toma "se necessario" registada pelo utilizador.
export interface MedicationIntake {
  id: string;
  medicationId: string;
  name: string;
  takenAt: string;
  dose: string | null;
  note: string | null;
}

export interface MedicationIntakeInput {
  medicationId: string;
  takenAt: string;
  dose?: string;
  note?: string;
}

// Aviso legal da medicacao: tem de ser aceite (versao atual) antes de usar.
export interface MedicationDisclaimerStatus {
  version: number;
  acceptedVersion: number | null;
  acceptedAt: string | null;
  acceptedLocale: string | null;
  accepted: boolean;
}


export interface MedicationDaySlot {
  medicationId: string;
  name: string;
  dosage: string | null;
  slotMinutes: number;
  taken: boolean;
}

export type CorrelationStrength = 'none' | 'weak' | 'moderate' | 'strong';

export type CorrelationResult =
  | { kind: 'not_enough_data'; sampleSize: number }
  | { kind: 'no_variation'; sampleSize: number }
  | { kind: 'ok'; sampleSize: number; r: number; strength: CorrelationStrength };

export interface WellbeingInsights {
  windowDays: number;
  loggedDays: number;
  averageMood: number | null;
  moodVsFocus: CorrelationResult;
  moodVsStudyMinutes: CorrelationResult;
  energyVsFocus: CorrelationResult;
  stressVsFocus: CorrelationResult;
  burnout: BurnoutResult;
}

export type BurnoutSignal = 'moodDrop' | 'energyDrop' | 'stressRise' | 'loadHeld';

// Ultima semana vs as 3 antes (ver backend/src/wellbeing/burnout.util.ts).
export type BurnoutResult =
  | { kind: 'not_enough_data'; recentLogs: number; baselineLogs: number }
  | { kind: 'ok'; signals: BurnoutSignal[] }
  | {
      kind: 'warning';
      signals: BurnoutSignal[];
      recentMood: number;
      baselineMood: number;
      recentStudyMinutesPerDay: number;
      baselineStudyMinutesPerDay: number;
    };

// Pad (bloco estilo dontpad, /pad/<slug>). version 0 = ainda nunca gravado.
export interface PadView {
  slug: string;
  content: string;
  version: number;
  updatedAt: string | null;
  // Trancado: todos leem, so a conta que trancou edita.
  locked: boolean;
  lockedByMe: boolean;
  // Limite de caracteres para quem pergunta (sem conta e menor); null = o normal.
  maxLength: number | null;
}

// Turma (Fase 7): grupo com delegado, notas, ficheiros e avisos.
export type TurmaRole = 'DELEGADO' | 'MEMBER';

export interface TurmaSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  myRole: TurmaRole;
  // Aviso mais recente (ISO) ou null; ver lib/turmaSeen.ts.
  latestAnnouncementAt: string | null;
}

// Convite direto pendente (GET /classes/invites).
export interface TurmaInvite {
  id: string;
  createdAt: string;
  turmaName: string;
  memberCount: number;
  invitedByName: string | null;
}

export interface TurmaMember {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  role: TurmaRole;
  joinedAt: string;
  /** Liga os Membros ao Social: amigo, pedido pendente ou da para adicionar. */
  friendStatus: 'NONE' | 'FRIEND' | 'REQUESTED' | 'INCOMING' | 'BLOCKED';
}

export interface TurmaDetail {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  membersCanEditNotes: boolean;
  myRole: TurmaRole;
  canEditNotes: boolean;
  members: TurmaMember[];
}

export interface TurmaAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorName: string | null;
}

export interface TurmaNoteSummary {
  id: string;
  title: string;
  updatedAt: string;
  updatedByName: string | null;
}

export interface TurmaNote extends TurmaNoteSummary {
  content: string;
  version: number;
  createdById: string | null;
}

// Mesma forma que o preview de anexos do Notebook usa (AttachmentActions).
// GET /tasks/:taskId/attachments. url = signed download link (short-lived).
export interface TaskAttachment {
  id: string;
  originalFileName: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
}

export interface TurmaFile {
  id: string;
  originalFileName: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById: string | null;
  uploadedByName: string | null;
  url: string | null;
}

// GET /classes/:id/packs: pacotes de tasks partilhados com a turma.
export interface TurmaPack {
  id: string;
  packId: string;
  name: string;
  code: string;
  itemCount: number;
  ownerName: string | null;
  sharedById: string;
  createdAt: string;
}

export interface TurmaLinkedArea {
  id: string;
  userId: string;
  ownerName: string | null;
  areaId: string;
  areaName: string;
  areaColor: string | null;
  entryCount: number;
}

export interface TurmaLinkedEntrySummary {
  id: string;
  title: string;
  entryType: NotebookEntryType;
  classNumber: number | null;
  date: string;
}

export interface TurmaLinkedEntry {
  ownerName: string | null;
  entry: SharedNotebookEntry;
}

// Linha da moderacao de pads (so admins veem quem gravou por ultimo).
export interface AdminPadRow {
  slug: string;
  length: number;
  preview: string;
  updatedAt: string;
  updatedBy: { id: string; name: string | null; email: string } | null;
  // Gravacao sem conta: hash do IP (nunca o IP) para ver spam da mesma origem.
  updatedByIpHash: string | null;
  sourceBlocked: boolean;
  lockedBy: { id: string; name: string | null; email: string } | null;
}

export interface TurmaNoteSearchResult {
  id: string;
  title: string;
  turmaId: string;
  turmaName: string;
}

// GET /wellbeing/medications/history: tomas marcadas vs tomadas.
export interface MedicationHistory {
  from: string;
  to: string;
  days: { date: string; scheduled: number; taken: number }[];
  medications: {
    id: string;
    name: string;
    schedule: 'DAILY' | 'AS_NEEDED';
    scheduled: number;
    taken: number;
    asNeeded: number;
  }[];
  totals: { scheduled: number; taken: number; asNeeded: number };
}

export type BloodDonationType = 'WHOLE_BLOOD' | 'PLASMA' | 'PLATELETS';

export interface BloodDonation {
  id: string;
  date: string; // YYYY-MM-DD
  type: BloodDonationType;
  location: string | null;
  note: string | null;
}

// Nota pessoal (/notes), com lembrete opcional.
export interface PersonalNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  remindAt: string | null;
  remindedAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Risco de chumbo por cadeira (GET /course-risk). Espelha CourseRisk em
// backend/src/approval-rules/approval-rules.types.ts.
export type ApprovalTrack = 'CONTINUOUS' | 'EXAM' | 'RESIT';
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
  | 'ONLY_EXAM_TRACK_LEFT';

export interface RiskReason {
  code: RiskReasonCode;
  params: Record<string, string | number>;
}

export interface CourseRisk {
  areaId: string;
  areaName: string;
  colorHex: string;
  score: number;
  level: RiskLevel;
  track: ApprovalTrack;
  reasons: RiskReason[];
  currentAverage: number | null;
  gradedWeightPct: number;
  remainingWeightPct: number;
  neededOnRemaining: number | null;
}

// Nota privada do aluno: nome do docente de uma cadeira (so dele).
export interface AreaTeacherNote {
  areaId: string;
  teacherName: string;
}

export const TEACHER_NAME_MAX_LENGTH = 100;

// N48: avaliacao privada de docente e cadeira (contrato do backend em
// area-ratings.types.ts). 1-5, null = sem avaliacao.
export interface AreaRating {
  areaId: string;
  teacherRating: number | null;
  courseLiking: number | null;
}

export interface RatingCourseRow {
  areaId: string;
  areaName: string;
  colorHex: string;
  teacherName: string | null;
  teacherRating: number | null;
  courseLiking: number | null;
  avgFocus: number | null;
  studiedMinutes: number;
  /** Nota final media normalizada 0-1, null sem notas. */
  gradeFraction: number | null;
}

export interface RatingQuadrants {
  likedGradeHigh: number;
  likedGradeLow: number;
  notLikedGradeHigh: number;
  notLikedGradeLow: number;
}

export interface RatingCorrelation {
  r: number | null;
  n: number;
  enough: boolean;
  // Porque nao ha r: poucos dados ou classificacoes todas iguais.
  reason?: 'insufficient' | 'no_variation' | null;
}

export interface TeacherRatingSummary {
  teacherName: string;
  courses: number;
  avgRating: number | null;
  avgGradeFraction: number | null;
}

export interface RatingStats {
  minSample: number;
  courses: RatingCourseRow[];
  quadrants: { teacher: RatingQuadrants; course: RatingQuadrants };
  correlations: {
    teacherVsGrade: RatingCorrelation;
    courseVsGrade: RatingCorrelation;
    focusVsGrade: RatingCorrelation;
    courseVsFocus: RatingCorrelation;
  };
  byTeacher: TeacherRatingSummary[];
}

export type AreaRatingField = 'teacherRating' | 'courseLiking';
