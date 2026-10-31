import api from './client';
import type { AreaRating, AreaRatingField, RatingStats } from '../types/models';

export const getAreaRatings = async (): Promise<AreaRating[]> => {
  const response = await api.get<AreaRating[]>('/area-ratings');
  return response.data;
};

// Periodo opcional (tem de ser do user); sem ele, todos os nao arquivados.
export const getRatingStats = async (periodId?: string, signal?: AbortSignal): Promise<RatingStats> => {
  const response = await api.get<RatingStats>('/area-ratings/stats', { params: { periodId }, signal });
  return response.data;
};

// Envia so o campo alterado (null limpa-o).
export const setAreaRating = async (
  areaId: string,
  field: AreaRatingField,
  value: number | null,
): Promise<AreaRating> => {
  const response = await api.put<AreaRating>(`/area-ratings/${areaId}`, { [field]: value });
  return response.data;
};
