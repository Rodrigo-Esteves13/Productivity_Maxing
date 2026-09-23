// src/api/notebookService.ts
import axios from 'axios';
import api from './client';
import type {
  CanvasLink,
  CanvasShape,
  CanvasTextItem,
  DetectClassResult,
  NotebookAttachment,
  NotebookEntry,
  NotebookEntryType,
  NotebookPhoto,
  NotebookSearchResult,
  NotebookTable,
  ScheduleLinkResult,
  SharedNotebookEntry,
  Stroke,
  UsefulLink,
} from '../types/models';

export interface CreateNotebookEntryPayload {
  areaId: string;
  classOccurrenceId?: string;
  title: string;
  entryType?: NotebookEntryType;
  classNumber?: number;
  textContent?: string;
  drawingStrokes?: Stroke[];
  tables?: NotebookTable[];
  canvasShapes?: CanvasShape[];
  canvasLinks?: CanvasLink[];
  canvasTexts?: CanvasTextItem[];
  usefulLinks?: UsefulLink[];
  canvasHeight?: number;
  date: string;
}

export type UpdateNotebookEntryPayload = Partial<
  Omit<CreateNotebookEntryPayload, 'areaId' | 'classOccurrenceId'>
>;

export const getNotebookEntries = async (areaId: string): Promise<NotebookEntry[]> => {
  const response = await api.get<NotebookEntry[]>('/notebook/entries', {
    params: { areaId },
  });
  return response.data;
};

export const getNotebookEntry = async (id: string): Promise<NotebookEntry> => {
  const response = await api.get<NotebookEntry>(`/notebook/entries/${id}`);
  return response.data;
};

export const createNotebookEntry = async (
  payload: CreateNotebookEntryPayload,
): Promise<NotebookEntry> => {
  const response = await api.post<NotebookEntry>('/notebook/entries', payload);
  return response.data;
};

export const updateNotebookEntry = async (
  id: string,
  payload: UpdateNotebookEntryPayload,
): Promise<NotebookEntry> => {
  const response = await api.patch<NotebookEntry>(`/notebook/entries/${id}`, payload);
  return response.data;
};

export const deleteNotebookEntry = async (id: string): Promise<void> => {
  await api.delete(`/notebook/entries/${id}`);
};

// multipart/form-data, mesmo padrão do uploadAvatar em userService.ts.
export const uploadNotebookPhoto = async (
  entryId: string,
  file: File,
): Promise<NotebookPhoto> => {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await api.post<NotebookPhoto>(
    `/notebook/entries/${entryId}/photos`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
};

export const deleteNotebookPhoto = async (
  entryId: string,
  photoId: string,
): Promise<void> => {
  await api.delete(`/notebook/entries/${entryId}/photos/${photoId}`);
};

// multipart/form-data, mesmo padrão do uploadNotebookPhoto acima - o
// backend é que valida o tipo real do ficheiro (magic bytes, ou para
// texto puro a ausência de bytes binários), a extensão só serve de
// pista para esse caso de texto.
export const uploadNotebookAttachment = async (
  entryId: string,
  file: File,
): Promise<NotebookAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<NotebookAttachment>(
    `/notebook/entries/${entryId}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
};

export const deleteNotebookAttachment = async (
  entryId: string,
  attachmentId: string,
): Promise<void> => {
  await api.delete(`/notebook/entries/${entryId}/attachments/${attachmentId}`);
};

export const getScheduleLink = async (areaId: string): Promise<ScheduleLinkResult> => {
  const response = await api.get<ScheduleLinkResult>('/notebook/schedule-links', {
    params: { areaId },
  });
  return response.data;
};

export const upsertScheduleLink = async (
  areaId: string,
  scheduleSubject: string,
): Promise<ScheduleLinkResult> => {
  const response = await api.post<{ scheduleSubject: string }>(
    '/notebook/schedule-links',
    { areaId, scheduleSubject },
  );
  return response.data;
};

export const removeScheduleLink = async (areaId: string): Promise<void> => {
  await api.delete(`/notebook/schedule-links/${areaId}`);
};

export const detectClassNow = async (areaId: string): Promise<DetectClassResult> => {
  const response = await api.get<DetectClassResult>('/notebook/detect-class', {
    params: { areaId },
  });
  return response.data;
};

export const searchNotebook = async (query: string): Promise<NotebookSearchResult[]> => {
  const response = await api.get<NotebookSearchResult[]>('/notebook/search', {
    params: { q: query },
  });
  return response.data;
};

// --- Partilha (link público só de leitura) --------------------------------

export interface ShareStatus {
  shared: boolean;
  token: string | null;
}

export const getShareStatus = async (entryId: string): Promise<ShareStatus> => {
  const response = await api.get<ShareStatus>(`/notebook/entries/${entryId}/share`);
  return response.data;
};

export const createShare = async (entryId: string): Promise<ShareStatus> => {
  const response = await api.post<ShareStatus>(`/notebook/entries/${entryId}/share`);
  return response.data;
};

export const revokeShare = async (entryId: string): Promise<ShareStatus> => {
  const response = await api.delete<ShareStatus>(`/notebook/entries/${entryId}/share`);
  return response.data;
};

// Sem `api` (que injeta o Authorization/CSRF de uma sessão autenticada) -
// quem abre um link partilhado normalmente não tem sessão nenhuma nesta
// app, e o endpoint nem tem guard que os leia. Um cliente axios à parte,
// sem credentials, evita mandar cookies desnecessários para um endpoint
// público.
export const getSharedNotebookEntry = async (token: string): Promise<SharedNotebookEntry> => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await axios.get<SharedNotebookEntry>(`${baseURL}/notebook/shared/${token}`);
  return response.data;
};
