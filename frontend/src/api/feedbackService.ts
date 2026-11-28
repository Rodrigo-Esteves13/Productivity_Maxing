import api from './client';
import type { FeedbackCategory, FeedbackItem, MyFeedbackItem } from '../types/models';

export async function sendFeedback(input: {
  category: FeedbackCategory;
  rating?: number;
  message: string;
  language: string;
  page: string;
}): Promise<void> {
  await api.post('/feedback', input);
}

// O que o proprio enviou, com as respostas do admin.
export async function getMyFeedback(): Promise<MyFeedbackItem[]> {
  const response = await api.get<MyFeedbackItem[]>('/feedback/mine');
  return response.data;
}

// Admin
// Igual a FEEDBACK_REPLY_MAX_LENGTH no backend (moderate-feedback.dto.ts).
export const FEEDBACK_REPLY_MAX_LENGTH = 2000;
// Itens por pagina e tamanho maximo da pesquisa (feedback.constants.ts).
export const FEEDBACK_PAGE_SIZE = 25;
export const FEEDBACK_SEARCH_MAX_LENGTH = 100;

export type FeedbackFilter = 'open' | 'closed' | 'all';

export interface FeedbackPageQuery {
  status: FeedbackFilter;
  skip: number;
  take: number;
  q?: string;
  category?: FeedbackCategory;
  language?: string;
}

export interface FeedbackPage {
  total: number;
  items: FeedbackItem[];
  // Por estado, ja com a pesquisa, categoria e lingua aplicadas.
  counts: Record<FeedbackFilter, number>;
  // Todas as linguas com feedback.
  languages: string[];
}

// Filtros e paginacao no servidor.
export async function getFeedbackPage(query: FeedbackPageQuery, signal?: AbortSignal): Promise<FeedbackPage> {
  const response = await api.get<FeedbackPage>('/feedback', { params: query, signal });
  return response.data;
}

export async function setFeedbackResolved(id: string, isResolved: boolean): Promise<FeedbackItem> {
  const response = await api.patch<FeedbackItem>(`/feedback/${id}/resolved`, { isResolved });
  return response.data;
}

// Resposta que o autor ve em /my-feedback (e recebe aviso push).
export async function replyToFeedback(
  id: string,
  input: { message: string; resolve: boolean },
): Promise<FeedbackItem> {
  const response = await api.post<FeedbackItem>(`/feedback/${id}/reply`, input);
  return response.data;
}

// Fecha como recusado; o motivo (opcional) chega ao autor.
export async function rejectFeedback(id: string, reason?: string): Promise<FeedbackItem> {
  const response = await api.post<FeedbackItem>(`/feedback/${id}/reject`, { reason });
  return response.data;
}

// Bloqueia (ou volta a permitir) um user de enviar feedback, sem banir a conta.
export async function setFeedbackMuted(userId: string, muted: boolean): Promise<void> {
  await api.patch(`/feedback/users/${userId}/muted`, { muted });
}

// Limites do texto, iguais aos do backend (create-feedback.dto.ts).
export const FEEDBACK_MESSAGE_MIN_LENGTH = 3;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

// O autor corrige o texto enquanto esta aberto e sem resposta.
export async function updateMyFeedback(id: string, message: string): Promise<void> {
  await api.patch(`/feedback/mine/${encodeURIComponent(id)}`, { message });
}

// Apaga um feedback do proprio autor (o backend recusa os de outros).
export async function deleteMyFeedback(id: string): Promise<void> {
  await api.delete(`/feedback/mine/${id}`);
}
