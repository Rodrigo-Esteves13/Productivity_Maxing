// src/api/taskAttachmentsService.ts
import api from './client';
import type { TaskAttachment } from '../types/models';

const base = (taskId: string) => `/tasks/${encodeURIComponent(taskId)}/attachments`;

export const getTaskAttachments = async (taskId: string): Promise<TaskAttachment[]> =>
  (await api.get<TaskAttachment[]>(base(taskId))).data;

export const uploadTaskAttachment = async (taskId: string, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('file', file);
  await api.post(base(taskId), formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const deleteTaskAttachment = async (taskId: string, attachmentId: string): Promise<void> => {
  await api.delete(`${base(taskId)}/${encodeURIComponent(attachmentId)}`);
};
