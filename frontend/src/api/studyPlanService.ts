// src/api/studyPlanService.ts
import api from './client';
import type { StudyPlanResult } from '../types/models';

export const getStudyPlan = async (days = 7): Promise<StudyPlanResult> => {
  const response = await api.get<StudyPlanResult>('/study-plan', {
    params: { days },
  });
  return response.data;
};
