// src/api/areaInterestsService.ts
import api from './client';

export interface AreaInterest {
  areaId: string;
  rating: number;
}

export const getAreaInterests = async (): Promise<AreaInterest[]> => {
  const response = await api.get<AreaInterest[]>('/area-interests');
  return response.data;
};

export const setAreaInterest = async (areaId: string, rating: number): Promise<AreaInterest> => {
  const response = await api.put<AreaInterest>(`/area-interests/${areaId}`, { rating });
  return response.data;
};

export const clearAreaInterest = async (areaId: string): Promise<void> => {
  await api.delete(`/area-interests/${areaId}`);
};
