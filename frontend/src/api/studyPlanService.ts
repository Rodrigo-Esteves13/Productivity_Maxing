// src/api/studyPlanService.ts
import api from './client';
import type { CourseForecast, GradeProjection, StudyPlanResult } from '../types/models';

export const getStudyPlan = async (days = 7, signal?: AbortSignal): Promise<StudyPlanResult> => {
  const response = await api.get<StudyPlanResult>('/study-plan', {
    params: { days },
    signal,
  });
  return response.data;
};

export const updateStudyPlanSettings = async (
  dailyLimitMinutes: number,
): Promise<{ dailyLimitMinutes: number }> => {
  const response = await api.patch<{ dailyLimitMinutes: number }>(
    '/study-plan/settings',
    { dailyLimitMinutes },
  );
  return response.data;
};

export const getGradeProjection = async (): Promise<GradeProjection> => {
  const response = await api.get<GradeProjection>('/study-plan/grade-projection');
  return response.data;
};

export const getCourseForecast = async (): Promise<CourseForecast[]> => {
  const response = await api.get<CourseForecast[]>('/study-plan/courses');
  return response.data;
};
