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
  NotebookEntrySummary,
  NotebookEntryType,
  NotebookPhoto,
  NotebookSearchResult,
  NotebookTable,
  ScheduleLinkResult,
  Stroke,
  UsefulLink,
} from '../types/models';
import { fetchAllPages } from './fetchAllPages';

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
  Omit<CreateNotebookEntryPayload, 'areaId' | 'classOccurrenceId' | 'classNumber'>
> & {
  // null limpa o numero (campo vazio ou tipo diferente de CLASS); undefined
  // desaparecia no JSON e o numero antigo ficava gravado.
  classNumber?: number | null;
  // So na edicao: a criacao segue User.notesPrivateByDefault.
  privateFromFriends?: boolean;
  // updatedAt da versao aberta: se a entrada mudou entretanto (co-owner,
  // outro separador) o backend responde 409 com a versao atual.
  baseUpdatedAt?: string;
};

// A lista da cadeira sem o conteudo das entradas (ver NotebookEntrySummary).
export const getNotebookEntrySummaries = async (areaId: string): Promise<NotebookEntrySummary[]> => {
  return fetchAllPages<NotebookEntrySummary>('/notebook/entry-summaries', { areaId });
};

// Todas as entradas da cadeira com o conteudo completo, de uma vez. Pesado
// (desenhos de todas as aulas): so para exportar a cadeira, nunca para a lista.
export const getNotebookEntriesFull = async (areaId: string): Promise<NotebookEntry[]> => {
  return fetchAllPages<NotebookEntry>('/notebook/entries', { areaId });
};

// Ids das fotos e anexos de uma entrada (barato, sem URLs assinados).
export const getNotebookEntryMediaIds = async (
  id: string,
): Promise<{ photoIds: string[]; attachmentIds: string[] }> =>
  (await api.get<{ photoIds: string[]; attachmentIds: string[] }>(`/notebook/entries/${id}/media-ids`)).data;

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

// Conteudo de um anexo para o preview. O URL e um signed URL do Supabase
// Storage (outro dominio), por isso vai sem o cliente `api`: nem cookies nem
// cabecalho CSRF devem sair para la.
export const fetchAttachmentContent = async (signedUrl: string): Promise<Blob> => {
  const response = await axios.get<Blob>(signedUrl, { responseType: 'blob', withCredentials: false });
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
