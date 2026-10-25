// src/api/studySessionsService.ts
import api from './client';
import type { StudySession, HeatmapCell, Task } from '../types/models';

export interface StartStudySessionInput {
  taskId?: string;
  areaId?: string;
  note?: string;
}

export interface StopStudySessionInput {
  note?: string;
  // Quando a sessao acabou de facto, se foi antes de agora (ISO).
  endedAt?: string;
  focusRating?: number;
}

export interface ManualSessionInput {
  startedAt: string;
  endedAt: string;
  taskId?: string;
  areaId?: string;
  note?: string;
  focusRating?: number;
}

export interface UpdateSessionInput {
  startedAt?: string;
  endedAt?: string;
  note?: string;
  focusRating?: number;
}

export const startStudySession = async (
  data: StartStudySessionInput,
): Promise<StudySession> => {
  const response = await api.post<StudySession>('/study-sessions/start', data);
  return response.data;
};

export const stopStudySession = async (
  id: string,
  data: StopStudySessionInput = {},
): Promise<StudySession> => {
  const response = await api.patch<StudySession>(
    `/study-sessions/${id}/stop`,
    data,
  );
  return response.data;
};

// Pinged every HEARTBEAT_INTERVAL_MS by StudySessionProvider while a
// session is active - lets StudySessionsService.autoCloseIfStale tell a
// genuinely-running session apart from one that was left open by
// accident. Fire-and-forget from the caller's side: a missed beat here
// and there is fine, see the comment on the backend constant.
// `plannedEndAt` (fim do bloco de foco planeado, ISO): enquanto estiver
// dentro dele, uma sessao sem contacto (telemovel bloqueado) nao e fechada.
export const heartbeatStudySession = async (id: string, plannedEndAt?: string): Promise<void> => {
  await api.post(`/study-sessions/${id}/heartbeat`, plannedEndAt ? { plannedEndAt } : {});
};

// "Got distracted": +1 na sessao ativa. Devolve o total novo.
export const recordDistraction = async (id: string): Promise<number> =>
  (await api.post<{ distractionCount: number }>(`/study-sessions/${id}/distraction`)).data.distractionCount;

export const getSessionHistory = async (days = 14, signal?: AbortSignal): Promise<StudySession[]> => {
  const response = await api.get<StudySession[]>('/study-sessions/history', { params: { days }, signal });
  return response.data;
};

export const createManualSession = async (data: ManualSessionInput): Promise<StudySession> => {
  const response = await api.post<StudySession>('/study-sessions/manual', data);
  return response.data;
};

export const updateStudySession = async (id: string, data: UpdateSessionInput): Promise<StudySession> => {
  const response = await api.patch<StudySession>(`/study-sessions/${id}`, data);
  return response.data;
};

export const deleteStudySession = async (id: string): Promise<void> => {
  await api.delete(`/study-sessions/${id}`);
};

export const getActiveStudySession = async (): Promise<StudySession | null> => {
  const response = await api.get<StudySession | ''>('/study-sessions/active');
  // 204 (sem sessao ativa) chega como corpo vazio.
  return response.data || null;
};

export const getStudyHeatmap = async (): Promise<HeatmapCell[]> => {
  const response = await api.get<HeatmapCell[]>('/study-sessions/heatmap');
  return response.data;
};

// Per-day totals for the last `days` days (today included) - powers the
// activity heatmap/streak widget on the Dashboard.
export interface DailyStudyTotal {
  date: string; // yyyy-mm-dd
  totalMinutes: number;
}

export const getDailyStudyTotals = async (days = 84): Promise<DailyStudyTotal[]> => {
  const response = await api.get<DailyStudyTotal[]>('/study-sessions/daily-totals', {
    params: { days },
  });
  return response.data;
};

export const getTodayTasks = async (): Promise<Task[]> => {
  const response = await api.get<Task[]>('/tasks/today');
  return response.data;
};

// Mirrors StudyStreak in the backend's study-sessions.service.ts.
export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  freezesUsedTotal: number;
  activeToday: boolean;
  atRisk: boolean;
}

export const getStudyStreak = async (): Promise<StudyStreak> => {
  const response = await api.get<StudyStreak>('/study-sessions/streak');
  return response.data;
};

// Mirrors AreaTimeBreakdown in the backend's study-sessions.service.ts.
export interface AreaTimeBreakdown {
  areaId: string | null; // null = sessions with no resolvable Area
  areaName: string;
  areaColorHex: string | null;
  totalMinutes: number;
  sessionCount: number;
}

export const getTimeByArea = async (): Promise<AreaTimeBreakdown[]> => {
  const response = await api.get<AreaTimeBreakdown[]>('/study-sessions/time-by-area');
  return response.data;
};
