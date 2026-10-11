// src/api/subtasksService.ts
import api from './client';
import type { Subtask } from '../types/models';

const base = (taskId: string) => `/tasks/${taskId}/subtasks`;

export const addSubtask = async (taskId: string, title: string): Promise<Subtask> => {
  const response = await api.post<Subtask>(base(taskId), { title });
  return response.data;
};

export const addSubtasksBulk = async (taskId: string, titles: string[]): Promise<Subtask[]> => {
  const response = await api.post<Subtask[]>(`${base(taskId)}/bulk`, { titles });
  return response.data;
};

export const updateSubtask = async (
  taskId: string,
  subtaskId: string,
  patch: { title?: string; isDone?: boolean },
): Promise<Subtask> => {
  const response = await api.patch<Subtask>(`${base(taskId)}/${subtaskId}`, patch);
  return response.data;
};

export const deleteSubtask = async (taskId: string, subtaskId: string): Promise<void> => {
  await api.delete(`${base(taskId)}/${subtaskId}`);
};
