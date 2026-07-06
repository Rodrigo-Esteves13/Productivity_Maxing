// src/api/userService.ts
import api from './client';
import type { User, Area, Task, TaskMeta } from '../types/models';

// AUTH ENDPOINTS
// Login/registo já não devolvem o JWT no corpo - o backend define-o num
// cookie HttpOnly diretamente. O que volta aqui é só o csrfToken, que o
// AuthContext guarda em memória (ver api/csrfStore.ts) para o reenviar no
// header X-CSRF-Token dos pedidos seguintes.
export const loginRequest = async (
  email: string,
  password: string,
): Promise<{ csrfToken: string }> => {
  const response = await api.post<{ csrfToken: string }>('/auth/login', {
    email,
    password,
  });
  return response.data;
};

export const registerRequest = async (data: {
  name?: string;
  email: string;
  password: string;
}): Promise<{ csrfToken: string }> => {
  const response = await api.post<{ csrfToken: string }>(
    '/auth/register',
    data,
  );
  return response.data;
};

export const logoutRequest = async (): Promise<void> => {
  await api.post('/auth/logout');
};

// Chamado depois de um redirect de OAuth (o cookie de sessão já lá está,
// mas o csrfToken não veio no redirect) e também no arranque da app, para
// verificar se ainda existe uma sessão válida e obter um csrf token novo.
export const fetchCsrfToken = async (): Promise<string> => {
  const response = await api.get<{ authenticated: boolean; csrfToken?: string }>(
    '/auth/csrf',
  );
  if (!response.data.authenticated || !response.data.csrfToken) {
    throw new Error('Not authenticated');
  }
  return response.data.csrfToken;
};

// USER ENDPOINTS
export const getUserProfile = async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
  return response.data;
};

// Atualiza o nome do utilizador autenticado.
export const updateUserProfile = async (data: { name?: string }): Promise<User> => {
  const response = await api.patch<User>('/auth/me', data);
  return response.data;
};

// Faz upload de uma nova foto de perfil (multipart/form-data). O backend
// trata do upload para o Supabase Storage e devolve o User já atualizado
// com o avatarUrl novo.
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await api.post<User>('/auth/me/avatar', formData, {
    // O cliente axios tem 'Content-Type: application/json' fixo por omissão;
    // ao pôr undefined aqui, deixamos o browser definir o boundary correto
    // do multipart automaticamente.
    headers: { 'Content-Type': undefined },
  });
  return response.data;
};

// Remove a foto de perfil atual (volta a mostrar as iniciais).
export const removeAvatar = async (): Promise<User> => {
  const response = await api.delete<User>('/auth/me/avatar');
  return response.data;
};

export const deleteAccount = async (): Promise<void> => {
  await api.delete('/auth/me');
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