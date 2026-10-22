import api from './client';
import type {
  Medication,
  MedicationDaySlot,
  MedicationInput,
  MoodLog,
  UpsertMoodInput,
  WellbeingInsights,
} from '../types/models';

export const getMoodLogs = async (from: string, to: string): Promise<MoodLog[]> =>
  (await api.get<MoodLog[]>('/wellbeing/mood', { params: { from, to } })).data;

export const saveMoodLog = async (date: string, input: UpsertMoodInput): Promise<MoodLog> =>
  (await api.put<MoodLog>(`/wellbeing/mood/${encodeURIComponent(date)}`, input)).data;

export const deleteMoodLog = async (date: string): Promise<void> => {
  await api.delete(`/wellbeing/mood/${encodeURIComponent(date)}`);
};

export const getWellbeingInsights = async (): Promise<WellbeingInsights> =>
  (await api.get<WellbeingInsights>('/wellbeing/insights')).data;

export const getMedications = async (): Promise<Medication[]> =>
  (await api.get<Medication[]>('/wellbeing/medications')).data;

export const getMedicationDay = async (date: string): Promise<MedicationDaySlot[]> =>
  (await api.get<MedicationDaySlot[]>('/wellbeing/medications/day', { params: { date } })).data;

export const createMedication = async (input: MedicationInput): Promise<Medication> =>
  (await api.post<Medication>('/wellbeing/medications', input)).data;

export const updateMedication = async (
  id: string,
  changes: Partial<MedicationInput> & { active?: boolean },
): Promise<Medication> => (await api.patch<Medication>(`/wellbeing/medications/${id}`, changes)).data;

export const deleteMedication = async (id: string): Promise<void> => {
  await api.delete(`/wellbeing/medications/${id}`);
};

export const setMedicationDose = async (
  id: string,
  dose: { date: string; slotMinutes: number; taken: boolean },
): Promise<void> => {
  await api.put(`/wellbeing/medications/${id}/doses`, dose);
};
