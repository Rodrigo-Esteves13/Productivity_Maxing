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
  NotebookShareVisibility,
  NotebookTable,
  ScheduleLinkResult,
  ShareAccessRequest,
  ShareAccessRequestStatus,
  SharedEntryResult,
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
  visibility: NotebookShareVisibility;
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

// Toggle PUBLIC <-> AUTHORIZED - só disponível depois de já haver uma
// partilha (createShare acima), não recria/altera o token.
export const updateShareVisibility = async (
  entryId: string,
  visibility: NotebookShareVisibility,
): Promise<ShareStatus> => {
  const response = await api.patch<ShareStatus>(
    `/notebook/entries/${entryId}/share/visibility`,
    { visibility },
  );
  return response.data;
};

// Lado do dono: quem pediu acesso a esta entry (partilha AUTHORIZED).
export const getShareAccessRequests = async (
  entryId: string,
): Promise<ShareAccessRequest[]> => {
  const response = await api.get<ShareAccessRequest[]>(
    `/notebook/entries/${entryId}/share/requests`,
  );
  return response.data;
};

export const decideShareAccessRequest = async (
  entryId: string,
  requestId: string,
  decision: 'APPROVED' | 'DENIED',
): Promise<ShareAccessRequest> => {
  const response = await api.patch<ShareAccessRequest>(
    `/notebook/entries/${entryId}/share/requests/${requestId}`,
    { decision },
  );
  return response.data;
};

// Sem `api` (que injeta o Authorization/CSRF de uma sessão autenticada por
// omissão) - a maioria de quem abre um link partilhado não tem sessão
// nenhuma nesta app, e uma partilha PUBLIC nem precisa que tenha. Um
// cliente axios à parte, mas com `withCredentials: true`: ao contrário do
// que este comentário dizia antes de existirem partilhas AUTHORIZED, os
// cookies TÊM de ir - é assim que o backend (OptionalJwtAuthGuard, ver
// NotebookShareController) reconhece uma pessoa já autenticada e decide
// entre login_required/not_requested/pending/denied/ok. Sem sessão
// nenhuma, os cookies simplesmente não têm nada para enviar - continua
// a funcionar normalmente para uma partilha PUBLIC.
export const getSharedNotebookEntry = async (token: string): Promise<SharedEntryResult> => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await axios.get<SharedEntryResult>(`${baseURL}/notebook/shared/${token}`, {
    withCredentials: true,
  });
  return response.data;
};

// Chamado pela pessoa DE FORA, já autenticada (ver Login.tsx: o redirect
// depois do login volta para esta página). Usa `api`, não o axios cru
// acima - isto MUTA estado (cria/atualiza um pedido) e precisa mesmo do
// CSRF token; ver SharedNotebookEntry.tsx, que chama fetchCsrfToken()
// antes disto se ainda não houver um token em memória.
export const requestShareAccess = async (
  token: string,
): Promise<{ status: ShareAccessRequestStatus }> => {
  const response = await api.post<{ status: ShareAccessRequestStatus }>(
    `/notebook/shared/${token}/request-access`,
  );
  return response.data;
};
