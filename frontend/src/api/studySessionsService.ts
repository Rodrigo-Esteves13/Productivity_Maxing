// src/api/studySessionsService.ts
import api from './client';
import { getCsrfToken } from './csrfStore';
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
export const heartbeatStudySession = async (id: string): Promise<void> => {
  await api.post(`/study-sessions/${id}/heartbeat`);
};

export const getSessionHistory = async (days = 14): Promise<StudySession[]> => {
  const response = await api.get<StudySession[]>('/study-sessions/history', { params: { days } });
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
  const response = await api.get<StudySession | null>('/study-sessions/active');
  return response.data;
};

// Fired from a `pagehide` listener (see StudySessionProvider.tsx) when the
// tab is closing or navigating away with an active session still running.
// Deliberately bypasses the axios `api` instance and calls `fetch`
// directly: axios' browser adapter has no `keepalive` option, and without
// it the browser is free to cancel the request the instant the page
// starts unloading. `fetch(..., { keepalive: true })` is the documented
// way to send a request that survives unload when it also needs a custom
// header - `navigator.sendBeacon` can't set X-CSRF-Token, which is why
// that's not used here instead.
//
// Best-effort only, and that's fine: if it doesn't land (browser killed
// outright, no network, CSRF token not loaded yet), the session isn't
// left "running forever" - the heartbeat above means the backend
// auto-closes it a few minutes later regardless, see
// StudySessionsService.autoCloseIfStale.
export function stopStudySessionOnUnload(id: string): void {
  const csrfToken = getCsrfToken();
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  void fetch(`${baseUrl}/study-sessions/${id}/stop`, {
    method: 'PATCH',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify({}),
  }).catch(() => {
    // Nothing to do here - see the comment above.
  });
}

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
