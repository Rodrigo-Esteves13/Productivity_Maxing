// src/api/userService.ts
import api from './client';
import type { User, Area, Task } from '../types/models';

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

// TASK ENDPOINTS
export const getUserTasks = async (): Promise<Task[]> => {
  const response = await api.get<Task[]>('/tasks');
  return response.data;
};

export async function createTask(taskData: any) {
  const response = await api.post('/tasks', taskData);
  return response.data;
}

export async function getTaskMetadata() {
  const response = await api.get('/tasks/meta');
  return response.data; 
}