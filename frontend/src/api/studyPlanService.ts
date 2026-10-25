// src/api/studyPlanService.ts
import api from './client';
import type {
  CourseForecast,
  FocusEffect,
  FocusScatterPoint,
  FocusTrendWeek,
  GradeProjection,
  PlanScenario,
  StudyPlanResult,
} from '../types/models';

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

export const getPlanScenario = async (): Promise<PlanScenario> => {
  const response = await api.get<PlanScenario>('/study-plan/plan-scenario');
  return response.data;
};

export const getCourseForecast = async (): Promise<CourseForecast[]> => {
  const response = await api.get<CourseForecast[]>('/study-plan/courses');
  return response.data;
};

export const getFocusEffect = async (): Promise<FocusEffect> => {
  const response = await api.get<FocusEffect>('/study-plan/focus-effect');
  return response.data;
};

export const getFocusTrend = async (): Promise<FocusTrendWeek[]> => {
  const response = await api.get<{ weeks: FocusTrendWeek[] }>('/study-plan/focus-trend');
  return response.data.weeks;
};

export const getFocusScatter = async (): Promise<FocusScatterPoint[]> => {
  const response = await api.get<{ points: FocusScatterPoint[] }>('/study-plan/focus-scatter');
  return response.data.points;
};
