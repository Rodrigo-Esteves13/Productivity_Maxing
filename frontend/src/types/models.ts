// src/types/models.ts

// ------------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------------
export type Provider = 'GOOGLE' | 'DISCORD' | 'GITHUB';
export type Role = 'USER' | 'ADMIN';
export type ProgressStatus = 'ADIANTADO' | 'TEMPO_ESPERADO' | 'ATRASADO' | 'MUITO_ATRASADO';
export type Difficulty = 'FACIL' | 'MEDIO' | 'DIFICIL' | 'MUITO_DIFICIL';
export type TaskType = 'ACADEMICO' | 'HABITO' | 'PROJETO' | 'EVENTO' | 'TRABALHO' | 'TAREFA_SIMPLES';
export type AcademicTaskType = 'FREQUENCIA' | 'TRABALHO_PRATICO' | 'TAREFA_SECUNDARIA';

// ------------------------------------------------------------------
// MODELS
// ------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  
  // Optional relations (depends on what your backend returns)
  areas?: Area[];
  tasks?: Task[];
}

export interface Area {
  id: string;
  userId: string;
  name: string;
  colorHex: string;
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