import api from './client';

// Mirrors StreakFreezeRow / StreakFreezeStatus in the backend's
// study-sessions/streak-freezes.service.ts.
export interface StreakFreezeRow {
  id: string;
  dateKey: string;
  createdAt: string;
}

export interface StreakFreezeStatus {
  todayKey: string;
  freezes: StreakFreezeRow[];
  todayFreezeId: string | null;
  usedThisWeek: number;
  maxPerWeek: number;
  canFreezeToday: boolean;
}

export const getStreakFreezeStatus = async (): Promise<StreakFreezeStatus> => {
  const response = await api.get<StreakFreezeStatus>('/streak-freezes');
  return response.data;
};

// Sem dateKey o backend usa hoje (Lisboa); so aceita hoje ou ontem.
export const createStreakFreeze = async (dateKey?: string): Promise<StreakFreezeRow> => {
  const response = await api.post<StreakFreezeRow>('/streak-freezes', dateKey ? { dateKey } : {});
  return response.data;
};

// So o descanso de hoje pode ser desfeito.
export const deleteStreakFreeze = async (id: string): Promise<void> => {
  await api.delete(`/streak-freezes/${id}`);
};
