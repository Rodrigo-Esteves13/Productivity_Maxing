// src/api/workShiftsService.ts
import api from './client';
import type {
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
  WorkShift,
  WorkShiftOccurrence,
} from '../types/models';

// `from`/`to` como "YYYY-MM-DD", intervalo máximo de 62 dias (validado no backend).
export const getWorkShiftRange = async (
  from: string,
  to: string,
): Promise<WorkShiftOccurrence[]> => {
  const response = await api.get<WorkShiftOccurrence[]>('/work-shifts/range', {
    params: { from, to },
  });
  return response.data;
};

export const createWorkShifts = async (
  shifts: CreateWorkShiftInput[],
): Promise<WorkShift[]> => {
  const response = await api.post<WorkShift[]>('/work-shifts', { shifts });
  return response.data;
};

export const updateWorkShift = async (
  id: string,
  changes: UpdateWorkShiftInput,
): Promise<WorkShift> => {
  const response = await api.patch<WorkShift>(`/work-shifts/${id}`, changes);
  return response.data;
};

export const deleteWorkShift = async (id: string): Promise<void> => {
  await api.delete(`/work-shifts/${id}`);
};
