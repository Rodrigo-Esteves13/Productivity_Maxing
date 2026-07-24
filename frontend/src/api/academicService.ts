// src/api/academicService.ts
import api from './client';
import type {
  AcademicProgram,
  AcademicPeriod,
  PeriodAverage,
  ProgramAverage,
  PeriodComparisonEntry,
} from '../types/models';

// PROGRAMS
export const getPrograms = async (): Promise<AcademicProgram[]> => {
  const response = await api.get<AcademicProgram[]>('/programs');
  return response.data;
};

export const createProgram = async (data: {
  name: string;
  gradeScale?: string;
  order?: number;
}): Promise<AcademicProgram> => {
  const response = await api.post<AcademicProgram>('/programs', data);
  return response.data;
};

export const updateProgram = async (
  id: string,
  data: { name?: string; gradeScale?: string; order?: number; isActive?: boolean },
): Promise<AcademicProgram> => {
  const response = await api.patch<AcademicProgram>(`/programs/${id}`, data);
  return response.data;
};

// Permanently deletes a program. The backend rejects with 409 if the
// program still has any task in it (any period, archived or not) - see
// DeleteProgramButton for how that error is surfaced.
export const deleteProgram = async (id: string): Promise<void> => {
  await api.delete(`/programs/${id}`);
};

export const getProgramPeriods = async (programId: string): Promise<AcademicPeriod[]> => {
  const response = await api.get<AcademicPeriod[]>(`/programs/${programId}/periods`);
  return response.data;
};

// Cumulative average of the WHOLE program (archived periods included).
export const getProgramAverage = async (programId: string): Promise<ProgramAverage> => {
  const response = await api.get<ProgramAverage>(`/programs/${programId}/average`);
  return response.data;
};

// One entry per period of the program, to compare progress over time
// (never cross-program).
export const getPeriodsComparison = async (
  programId: string,
): Promise<PeriodComparisonEntry[]> => {
  const response = await api.get<PeriodComparisonEntry[]>(
    `/programs/${programId}/periods-comparison`,
  );
  return response.data;
};

// PERIODS
export const createPeriod = async (data: {
  programId: string;
  name: string;
  startDate: string;
  endDate?: string;
}): Promise<AcademicPeriod> => {
  const response = await api.post<AcademicPeriod>('/periods', data);
  return response.data;
};

// Renames a period and/or edits its dates. Doesn't touch isArchived -
// use archivePeriod/restorePeriod for that.
export const updatePeriod = async (
  id: string,
  data: { name?: string; startDate?: string; endDate?: string | null },
): Promise<AcademicPeriod> => {
  const response = await api.patch<AcademicPeriod>(`/periods/${id}`, data);
  return response.data;
};

// Archives the period. If it's the program's most recent period with no
// successor, the backend refuses with a 409 unless confirm:true is
// explicitly sent (see ArchivePeriodButton for the confirmation flow).
export const archivePeriod = async (id: string, confirm = false): Promise<AcademicPeriod> => {
  const response = await api.patch<AcademicPeriod>(`/periods/${id}/archive`, { confirm });
  return response.data;
};

// Average of this period only.
export const getPeriodAverage = async (periodId: string): Promise<PeriodAverage> => {
  const response = await api.get<PeriodAverage>(`/periods/${periodId}/average`);
  return response.data;
};

// Undoes archivePeriod. No restrictions on the backend - restoring a
// period never leaves the user without an active dashboard.
export const restorePeriod = async (id: string): Promise<AcademicPeriod> => {
  const response = await api.patch<AcademicPeriod>(`/periods/${id}/restore`);
  return response.data;
};

// Toggles this period as the one its program auto-selects on switch/reload,
// instead of always the most recent one. Pinning one unpins any previously
// pinned period in the same program (enforced on the backend).
export const togglePeriodPin = async (id: string): Promise<AcademicPeriod> => {
  const response = await api.patch<AcademicPeriod>(`/periods/${id}/pin`);
  return response.data;
};

// Sets this period (and its program) as the user's active dashboard -
// persisted on the backend, see GET /auth/me (activeProgramId/activePeriodId).
export const activatePeriod = async (id: string): Promise<AcademicPeriod> => {
  const response = await api.patch<AcademicPeriod>(`/periods/${id}/activate`);
  return response.data;
};
