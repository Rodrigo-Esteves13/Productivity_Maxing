// src/api/prioritiesAdminService.ts
import api from './client';
import type { AdminPriority } from '../types/models';

// ADMIN endpoints (todos exigem role ADMIN no backend, ver
// priorities.controller.ts). Sem "key" no payload - o backend gera-a
// sozinho a partir do label (ver priorities.service.ts), mesmo padrão que
// taskTypesAdminService.ts já usa para TaskType.

export interface PriorityFormPayload {
  label: string;
  colorHex?: string;
  order?: number;
  isActive?: boolean;
}

export const getAdminPriorities = async (): Promise<AdminPriority[]> => {
  const response = await api.get<AdminPriority[]>('/admin/priorities');
  return response.data;
};

export const createAdminPriority = async (
  data: PriorityFormPayload,
): Promise<AdminPriority> => {
  const response = await api.post<AdminPriority>('/admin/priorities', data);
  return response.data;
};

export const updateAdminPriority = async (
  id: string,
  data: Partial<PriorityFormPayload>,
): Promise<AdminPriority> => {
  const response = await api.patch<AdminPriority>(`/admin/priorities/${id}`, data);
  return response.data;
};

// Soft delete no backend (isActive: false) - nunca apaga a sério.
export const deactivateAdminPriority = async (id: string): Promise<AdminPriority> => {
  const response = await api.delete<AdminPriority>(`/admin/priorities/${id}`);
  return response.data;
};
