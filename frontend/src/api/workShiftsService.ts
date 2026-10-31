// src/api/workShiftsService.ts
import api from './client';
import type {
  CopyWeekInput,
  CopyWeekResult,
  CreateScheduleExceptionInput,
  CreateWorkShiftInput,
  ScheduleException,
  UpdateWorkShiftInput,
  WorkShift,
  WorkShiftOccurrence,
} from '../types/models';

// `from`/`to` como "YYYY-MM-DD", intervalo máximo de 62 dias (validado no backend).
// withSkipped: inclui os turnos que nao acontecem (folga, ferias, feriado),
// com `skipped`, para a grelha os mostrar riscados e os poder repor.
export const getWorkShiftRange = async (
  from: string,
  to: string,
  withSkipped = false,
): Promise<WorkShiftOccurrence[]> => {
  const response = await api.get<WorkShiftOccurrence[]>('/work-shifts/range', {
    params: { from, to, ...(withSkipped && { withSkipped: true }) },
  });
  return response.data;
};

// Folgas, ferias e mudancas de hora do horario semanal.
export const getScheduleExceptions = async (): Promise<ScheduleException[]> =>
  (await api.get<ScheduleException[]>('/schedule-exceptions')).data;

export const createScheduleException = async (
  input: CreateScheduleExceptionInput,
): Promise<ScheduleException> =>
  (await api.post<ScheduleException>('/schedule-exceptions', input)).data;

export const deleteScheduleException = async (id: string): Promise<void> => {
  await api.delete(`/schedule-exceptions/${encodeURIComponent(id)}`);
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

export const copyWeekShifts = async (
  input: CopyWeekInput,
): Promise<CopyWeekResult> => {
  const response = await api.post<CopyWeekResult>('/work-shifts/copy-week', input);
  return response.data;
};
