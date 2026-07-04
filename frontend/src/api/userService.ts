// src/api/userService.ts
import api from './client';
import type { User, Area, Task, TaskMeta } from '../types/models';

// USER ENDPOINTS
export const getUserProfile = async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
  return response.data;
};

// AREA ENDPOINTS
export const getUserAreas = async (): Promise<Area[]> => {
  const response = await api.get<Area[]>('/areas');
  return response.data;
};
export async function createArea(areaData: { name: string; colorHex: string }): Promise<Area> {
  const response = await api.post<Area>('/areas', areaData);
  return response.data;
}

export async function deleteArea(id: string): Promise<void> {
  await api.delete(`/areas/${id}`);
}
export async function updateArea(id: string, areaData: { name?: string; colorHex?: string }): Promise<Area> {
  const response = await api.patch<Area>(`/areas/${id}`, areaData);
  return response.data;
}

// TASK ENDPOINTS
export const getUserTasks = async (): Promise<Task[]> => {
  const response = await api.get<Task[]>('/tasks');
  return response.data;
};

export async function createTask(taskData: any) {
  const response = await api.post('/tasks', taskData);
  return response.data;
}

export async function getTaskMetadata(): Promise<TaskMeta> {
  const response = await api.get<TaskMeta>('/tasks/meta');
  return response.data;
}

export async function getTaskById(id: string): Promise<Task> {
  const response = await api.get<Task>(`/tasks/${id}`);
  return response.data;
}

export async function updateTask(id: string, taskData: any): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${id}`, taskData);
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}