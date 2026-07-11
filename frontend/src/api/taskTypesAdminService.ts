// src/api/taskTypesAdminService.ts
import api from './client';
import type { AdminTaskType, AdminAcademicTaskType } from '../types/models';

// ADMIN endpoints (todos exigem role ADMIN no backend, ver
// task-types.controller.ts). Sem "key" em lado nenhum destes payloads - o
// backend gera-a sozinho a partir do label em createTaskType/
// createAcademicTaskType (ver generate-key.ts).

export interface TaskTypeFormPayload {
  label: string;
  colorHex?: string;
  order?: number;
  isActive?: boolean;
}

export interface AcademicTaskTypeFormPayload {
  label: string;
  taskTypeId: string;
  order?: number;
  isActive?: boolean;
}

// TaskType

export const getAdminTaskTypes = async (): Promise<AdminTaskType[]> => {
  const response = await api.get<AdminTaskType[]>('/admin/task-types');
  return response.data;
};

export const createAdminTaskType = async (
  data: TaskTypeFormPayload,
): Promise<AdminTaskType> => {
  const response = await api.post<AdminTaskType>('/admin/task-types', data);
  return response.data;
};

export const updateAdminTaskType = async (
  id: string,
  data: Partial<TaskTypeFormPayload>,
): Promise<AdminTaskType> => {
  const response = await api.patch<AdminTaskType>(`/admin/task-types/${id}`, data);
  return response.data;
};

// Soft delete no backend (isActive: false) - nunca apaga a sério.
export const deactivateAdminTaskType = async (id: string): Promise<AdminTaskType> => {
  const response = await api.delete<AdminTaskType>(`/admin/task-types/${id}`);
  return response.data;
};

// AcademicTaskType

export const getAdminAcademicTaskTypes = async (): Promise<AdminAcademicTaskType[]> => {
  const response = await api.get<AdminAcademicTaskType[]>('/admin/academic-task-types');
  return response.data;
};

export const createAdminAcademicTaskType = async (
  data: AcademicTaskTypeFormPayload,
): Promise<AdminAcademicTaskType> => {
  const response = await api.post<AdminAcademicTaskType>('/admin/academic-task-types', data);
  return response.data;
};

export const updateAdminAcademicTaskType = async (
  id: string,
  data: Partial<AcademicTaskTypeFormPayload>,
): Promise<AdminAcademicTaskType> => {
  const response = await api.patch<AdminAcademicTaskType>(
    `/admin/academic-task-types/${id}`,
    data,
  );
  return response.data;
};

export const deactivateAdminAcademicTaskType = async (
  id: string,
): Promise<AdminAcademicTaskType> => {
  const response = await api.delete<AdminAcademicTaskType>(`/admin/academic-task-types/${id}`);
  return response.data;
};
