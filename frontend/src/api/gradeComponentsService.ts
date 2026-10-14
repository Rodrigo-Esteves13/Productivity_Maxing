// src/api/gradeComponentsService.ts
import api from './client';
import type { GradeComponent, GradeComponentInput } from '../types/models';

export const getGradeComponents = async (params: {
  areaId: string;
  periodId: string;
}): Promise<GradeComponent[]> => {
  const response = await api.get<GradeComponent[]>('/grade-components', { params });
  return response.data;
};

export const createGradeComponent = async (
  input: GradeComponentInput & { areaId: string; periodId: string },
): Promise<GradeComponent> => {
  const response = await api.post<GradeComponent>('/grade-components', input);
  return response.data;
};

export const updateGradeComponent = async (
  id: string,
  changes: Partial<GradeComponentInput>,
): Promise<GradeComponent> => {
  const response = await api.patch<GradeComponent>(`/grade-components/${id}`, changes);
  return response.data;
};

export const deleteGradeComponent = async (id: string): Promise<void> => {
  await api.delete(`/grade-components/${id}`);
};

export interface GradeEntryInput {
  grade: number;
  label?: string;
  date?: string;
}

export const addGradeEntry = async (componentId: string, input: GradeEntryInput): Promise<GradeComponent> => {
  const response = await api.post<GradeComponent>(`/grade-components/${componentId}/entries`, input);
  return response.data;
};

export const updateGradeEntry = async (
  componentId: string,
  entryId: string,
  changes: Partial<GradeEntryInput>,
): Promise<GradeComponent> => {
  const response = await api.patch<GradeComponent>(
    `/grade-components/${componentId}/entries/${entryId}`,
    changes,
  );
  return response.data;
};

export const removeGradeEntry = async (componentId: string, entryId: string): Promise<GradeComponent> => {
  const response = await api.delete<GradeComponent>(`/grade-components/${componentId}/entries/${entryId}`);
  return response.data;
};
