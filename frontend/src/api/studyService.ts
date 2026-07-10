// src/api/studyService.ts
import api from './client';
import type { StudySession, StudySessionMode, BestTimesResponse, TodayPlanResponse } from '../types/models';

export async function startStudySession(data: {
  taskId?: string;
  mode: StudySessionMode;
}): Promise<StudySession> {
  const response = await api.post<StudySession>('/study-sessions/start', {
    ...data,
    // Hora local do BROWSER, não do servidor - é o que faz o modelo
    // aprender o teu horário real, não o UTC de onde o backend corre.
    clientHourOfDay: new Date().getHours(),
    clientDayOfWeek: new Date().getDay(),
  });
  return response.data;
}

export async function endStudySession(id: string, focusRating?: number): Promise<StudySession> {
  const response = await api.patch<StudySession>(`/study-sessions/${id}/end`, { focusRating });
  return response.data;
}

export async function getActiveStudySession(): Promise<StudySession | null> {
  const response = await api.get<StudySession | null>('/study-sessions/active');
  return response.data;
}

export async function getStudySessionHistory(): Promise<StudySession[]> {
  const response = await api.get<StudySession[]>('/study-sessions');
  return response.data;
}

export async function getBestTimes(): Promise<BestTimesResponse> {
  const response = await api.get<BestTimesResponse>('/study-predictions/best-times');
  return response.data;
}

export async function getTodayPlan(availableMinutes: number): Promise<TodayPlanResponse> {
  const response = await api.get<TodayPlanResponse>('/study-predictions/today-plan', {
    params: { availableMinutes },
  });
  return response.data;
}
