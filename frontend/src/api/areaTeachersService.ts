// src/api/areaTeachersService.ts
import api from './client';
import type { AreaTeacherNote } from '../types/models';

export const getAreaTeachers = async (): Promise<AreaTeacherNote[]> => {
  const response = await api.get<AreaTeacherNote[]>('/area-teachers');
  return response.data;
};

export const setAreaTeacher = async (areaId: string, teacherName: string): Promise<AreaTeacherNote> => {
  const response = await api.put<AreaTeacherNote>(`/area-teachers/${areaId}`, { teacherName });
  return response.data;
};

export const clearAreaTeacher = async (areaId: string): Promise<void> => {
  await api.delete(`/area-teachers/${areaId}`);
};
