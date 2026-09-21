// src/api/notebookService.ts
import api from './client';
import type {
  CanvasLink,
  CanvasShape,
  CanvasTextItem,
  DetectClassResult,
  NotebookEntry,
  NotebookEntryType,
  NotebookPhoto,
  NotebookSearchResult,
  NotebookTable,
  ScheduleLinkResult,
  Stroke,
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
