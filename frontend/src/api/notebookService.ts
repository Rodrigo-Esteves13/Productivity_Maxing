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
  NotebookShareVisibility,
  NotebookTable,
  ScheduleLinkResult,
  ChangeProposal,
  ShareAccessRequest,
  ShareVisits,
  ShareAccessRequestStatus,
  ShareAccessRole,
  SharedEntryResult,
  Stroke,
  UsefulLink,
} from '../types/models';
import { API_BASE_URL } from './apiBaseUrl';

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
> & {
  // So na edicao: a criacao segue User.notesPrivateByDefault.
  privateFromFriends?: boolean;
};

// A lista da cadeira sem o conteudo das entradas (ver NotebookEntrySummary).
export const getNotebookEntrySummaries = async (areaId: string): Promise<NotebookEntrySummary[]> => {
  const response = await api.get<NotebookEntrySummary[]>('/notebook/entry-summaries', {
    params: { areaId },
  });
  return response.data;
};

// Todas as entradas da cadeira com o conteudo completo, de uma vez. Pesado
// (desenhos de todas as aulas): so para exportar a cadeira, nunca para a lista.
export const getNotebookEntriesFull = async (areaId: string): Promise<NotebookEntry[]> => {
  const response = await api.get<NotebookEntry[]>('/notebook/entries', { params: { areaId } });
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

export const getShareVisits = async (entryId: string): Promise<ShareVisits> => {
  const response = await api.get<ShareVisits>(`/notebook/entries/${entryId}/share/visits`);
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
  role?: ShareAccessRole,
): Promise<{ id: string; status: ShareAccessRequestStatus; accessRole: ShareAccessRole }> => {
  const response = await api.patch<{ id: string; status: ShareAccessRequestStatus; accessRole: ShareAccessRole }>(
    `/notebook/entries/${entryId}/share/requests/${requestId}`,
    { decision, role },
  );
  return response.data;
};

export const getChangeProposals = async (entryId: string): Promise<ChangeProposal[]> => {
  const response = await api.get<ChangeProposal[]>(`/notebook/entries/${entryId}/share/proposals`);
  return response.data;
};

export const decideChangeProposal = async (
  entryId: string,
  proposalId: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<{ id: string; status: 'APPROVED' | 'REJECTED' }> => {
  const response = await api.patch<{ id: string; status: 'APPROVED' | 'REJECTED' }>(
    `/notebook/entries/${entryId}/share/proposals/${proposalId}`,
    { decision },
  );
  return response.data;
};

// CO_OWNER aplica logo; EDITOR cria/substitui a sua proposta pendente.
export const editSharedEntry = async (
  token: string,
  payload: { title?: string; textContent?: string; note?: string },
): Promise<{ applied: boolean; proposalId?: string }> => {
  const response = await api.post<{ applied: boolean; proposalId?: string }>(
    `/notebook/shared/${token}/edit`,
    payload,
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
  const baseURL = API_BASE_URL;
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

export type SharedWithMeStatus = 'APPROVED' | 'PENDING' | 'DENIED' | 'PUBLIC';
export type SharedWithMeRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';

export interface SharedWithMeItem {
  token: string;
  status: SharedWithMeStatus;
  role: SharedWithMeRole;
  // Convite do dono a espera de resposta tua.
  invited: boolean;
  requestId: string | null;
  title: string | null;
  areaName: string | null;
  areaColor: string | null;
  ownerName: string | null;
  lastActivityAt: string;
}

// Aulas que outras pessoas partilharam comigo (pedidos meus + links publicos
// que abri com sessao). Titulo/dono so vem preenchido com acesso aprovado.
export const getSharedWithMe = async (): Promise<SharedWithMeItem[]> => {
  const response = await api.get<SharedWithMeItem[]>('/notebook/shared/with-me');
  return response.data;
};

// --- Convites de amigos para UMA nota -------------------------------------

export const inviteFriendToEntry = async (
  entryId: string,
  friendId: string,
  role: ShareAccessRole,
): Promise<{ id: string; status: ShareAccessRequestStatus; accessRole: ShareAccessRole }> => {
  const response = await api.post<{ id: string; status: ShareAccessRequestStatus; accessRole: ShareAccessRole }>(
    `/notebook/entries/${entryId}/share/invite`,
    { friendId, role },
  );
  return response.data;
};

/** Dono: tira o acesso a uma pessoa (ou cancela um convite pendente). */
export const removeShareAccess = async (entryId: string, requestId: string): Promise<void> => {
  await api.delete(`/notebook/entries/${entryId}/share/access/${requestId}`);
};

/** Convidado: aceita ou recusa. `token` vem preenchido quando aceita. */
export const respondToInvitation = async (
  requestId: string,
  accept: boolean,
): Promise<{ id: string; status: ShareAccessRequestStatus; token: string | null }> => {
  const response = await api.post<{ id: string; status: ShareAccessRequestStatus; token: string | null }>(
    `/notebook/invitations/${requestId}/respond`,
    { accept },
  );
  return response.data;
};
