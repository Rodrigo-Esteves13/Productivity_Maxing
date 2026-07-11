// ENUMS
export type Provider = 'GOOGLE' | 'DISCORD' | 'GITHUB';
export type Role = 'USER' | 'ADMIN';
export type ProgressStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'VERY_BEHIND' | 'COMPLETED';
export type Difficulty = 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';
export type SecurityEventType = 'RATE_LIMIT_EXCEEDED';
// Deixaram de ser union types fixas: agora vêm da BD (tabela editável pelo admin),
// por isso passam a ser `string` (a "key" devolvida por /tasks/meta).
export type TaskType = string;
export type AcademicTaskType = string;

// Formato devolvido por /tasks/meta para popular os selects
export interface TaskTypeOption {
  key: string;
  label: string;
  colorHex?: string | null;
}

export interface AcademicTaskTypeOption {
  key: string;
  label: string;
  taskTypeKey: string; // a que TaskType pertence, ex: "ACADEMICO"
}

export interface TaskMeta {
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses: string[];
}

// Registos completos usados só pela área de admin (/admin/task-types,
// /admin/academic-task-types) - distintos das *Option acima (essas são a
// versão "resumida" para popular selects, vinda de /tasks/meta). Nota:
// não há "key" editável aqui de propósito - é gerada automaticamente pelo
// backend a partir do label e nunca é exposta para edição (só o label, a
// cor, a ordem e o estado ativo/inativo são).
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
  taskTypeId: string;
  taskType: { id: string; key: string; label: string; colorHex: string | null } | null;
}

// 
// MODELS
// 

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  // true se a conta já tem uma credencial de password (via Supabase Auth) -
  // false para contas que só entraram por OAuth. Nunca expõe supabaseAuthId
  // em si, só este booleano.
  hasPassword: boolean;

  // Optional relations (depends on what your backend returns)
  areas?: Area[];
  tasks?: Task[];
}

export interface Area {
  id: string;
  userId: string;
  name: string;
  colorHex: string;
  // Key do TaskType usado por omissão nesta Area (null = sem tipo associado).
  defaultTaskType: string | null;
}

export interface Task {
  id: string;
  userId: string;
  areaId: string;
  title: string;
  date: string; // ISO String format from backend
  
  // Typology
  type: TaskType;
  academicType: AcademicTaskType | null;
  topics: string | null;

  // Execution Metadata
  weightPercentage: number | null;
  difficulty: Difficulty;
  progressStatus: ProgressStatus;
  referenceLink: string | null;
  
  // Evaluation
  targetGrade: number | null;
  realGrade: number | null;
  
  // Integrations & Timestamps
  googleCalendarEventId: string | null;
  createdAt: string;
  completedAt: string | null; // Momento real em que passou a COMPLETED
  lastOverdueCheckAt: string | null; // Última vez que o overdue check-in perguntou por esta task

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
  // null enquanto a sessão está ativa (endedAt ainda não existe)
  durationSeconds: number | null;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0 (Domingo) - 6 (Sábado)
  hourBucket: number; // 0 (00h-04h) - 5 (20h-24h)
  totalMinutes: number;
  sessionCount: number;
}