// src/api/scheduleService.ts
import api from './client';
import type {
  ClassOccurrence,
  SubjectAttendance,
  StudyVsClass,
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
  signal?: AbortSignal,
): Promise<ClassOccurrence[]> => {
  const response = await api.get<ClassOccurrence[]>('/schedule', {
    params: { from, to },
    signal,
  });
  return response.data;
};

// Presenca numa aula: true = fui, false = faltei, null = limpar.
export const setClassAttendance = async (
  id: string,
  attended: boolean | null,
): Promise<void> => {
  await api.patch(`/schedule/${encodeURIComponent(id)}/attendance`, { attended });
};

// Aula que nao houve (professor faltou): riscada na grelha, liberta o tempo
// no plano e limpa a presenca. false volta a pô-la normal.
export const setClassCancelled = async (
  id: string,
  cancelled: boolean,
): Promise<{ id: string; cancelled: boolean; attended: boolean | null }> => {
  const response = await api.patch(`/schedule/${encodeURIComponent(id)}/cancelled`, { cancelled });
  return response.data as { id: string; cancelled: boolean; attended: boolean | null };
};

// Presencas por disciplina entre from/to ("YYYY-MM-DD"); o backend corta em hoje.
export const getAttendanceSummary = async (
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<SubjectAttendance[]> => {
  const response = await api.get<SubjectAttendance[]>('/schedule/attendance', {
    params: { from, to },
    signal,
  });
  return response.data;
};

export const getStudyVsClass = async (
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<StudyVsClass> => {
  const response = await api.get<StudyVsClass>('/schedule/study-vs-class', {
    params: { from, to },
    signal,
  });
  return response.data;
};

// Apaga o horario importado (tudo, ou so entre from/to "YYYY-MM-DD").
// Nao toca em turnos nem em apontamentos do caderno.
export const deleteImportedClasses = async (
  range?: { from: string; to: string },
): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number }>('/schedule', {
    params: range,
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
