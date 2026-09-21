// src/api/scheduleService.ts
import api from './client';
import type {
  ClassOccurrence,
  CommuteMode,
  ImportScheduleRow,
  ImportScheduleResult,
} from '../types/models';

export const importSchedule = async (
  occurrences: ImportScheduleRow[],
): Promise<ImportScheduleResult> => {
  const response = await api.post<ImportScheduleResult>('/schedule/import', {
    occurrences,
  });
  return response.data;
};

// `from`/`to` como "YYYY-MM-DD" - o backend expande `to` para o fim desse
// dia (ver ScheduleService.findRange), por isso passar a mesma data em
// `from` e `to` já devolve as aulas desse dia inteiro.
export const getSchedule = async (
  from: string,
  to: string,
): Promise<ClassOccurrence[]> => {
  const response = await api.get<ClassOccurrence[]>('/schedule', {
    params: { from, to },
  });
  return response.data;
};

export const estimateCommute = async (
  homeAddress: string,
  campusAddress: string,
  mode: CommuteMode,
): Promise<{
  homeAddress: string;
  campusAddress: string;
  commuteMinutes: number;
  commuteMode: CommuteMode;
}> => {
  const response = await api.post('/schedule/commute/estimate', {
    homeAddress,
    campusAddress,
    mode,
  });
  return response.data;
};
