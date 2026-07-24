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

export const getActiveStudySession = async (): Promise<StudySession | null> => {
  const response = await api.get<StudySession | null>('/study-sessions/active');
  return response.data;
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
