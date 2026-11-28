// src/api/areasService.ts
import api from './client';
import { cachedQuery } from './queryCache';
import { AREAS_QUERY, areasKey } from './catalogCache';
import { notifyDomainChanged } from '../lib/domainEvents';
import type { Area, AreaProposal } from '../types/models';

// AREA ENDPOINTS
// includeHidden: só a página Áreas o usa, para poder voltar a ligar as oficiais
// desligadas. Os seletores (tasks, caderno...) não o passam e não as veem.
// Com cache (F-16, ver catalogCache.ts): invalidada por qualquer escrita.
export const getUserAreas = async (periodId?: string, includeHidden = false): Promise<Area[]> => {
  const params: Record<string, string> = {};
  if (periodId) params.periodId = periodId;
  if (includeHidden) params.includeHidden = 'true';
  return cachedQuery(
    areasKey(periodId, includeHidden),
    async (signal) => (await api.get<Area[]>('/areas', { params, signal })).data,
    AREAS_QUERY,
  );
};
export async function setAreaHidden(id: string, hidden: boolean): Promise<void> {
  await api.put(`/areas/${id}/visibility`, { hidden });
}
export async function setAllOfficialAreasHidden(hidden: boolean): Promise<void> {
  await api.put('/areas/visibility', { hidden });
}
export async function createArea(areaData: { name: string; colorHex: string; defaultTaskType?: string | null; credits?: number | null }): Promise<Area> {
  const response = await api.post<Area>('/areas', areaData);
  return response.data;
}

// Só admin: área OFICIAL (visível a todos).
export async function createOfficialArea(areaData: { name: string; colorHex: string; defaultTaskType?: string | null; credits?: number | null }): Promise<Area> {
  const response = await api.post<Area>('/areas/official', areaData);
  return response.data;
}

export async function proposeArea(id: string): Promise<Area> {
  const response = await api.post<Area>(`/areas/${id}/propose`);
  return response.data;
}

export async function withdrawAreaProposal(id: string): Promise<Area> {
  const response = await api.post<Area>(`/areas/${id}/withdraw`);
  return response.data;
}

export async function getAreaProposals(): Promise<AreaProposal[]> {
  const response = await api.get<AreaProposal[]>('/areas/proposals');
  return response.data;
}

export async function approveAreaProposal(id: string): Promise<void> {
  await api.post(`/areas/${id}/approve`);
}

export async function rejectAreaProposal(id: string, note?: string): Promise<void> {
  await api.post(`/areas/${id}/reject`, { note: note?.trim() || undefined });
}

export async function deleteArea(id: string): Promise<void> {
  await api.delete(`/areas/${id}`);
  // As tasks da Area apagada saem dos resumos (Areas, Dashboard).
  notifyDomainChanged('tasks');
}
export async function updateArea(id: string, areaData: { name?: string; colorHex?: string; defaultTaskType?: string | null; credits?: number | null }): Promise<Area> {
  const response = await api.patch<Area>(`/areas/${id}`, areaData);
  return response.data;
}
