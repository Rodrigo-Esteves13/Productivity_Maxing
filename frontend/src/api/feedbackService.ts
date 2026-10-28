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
// Igual ao take de FeedbackService.list no backend: com este numero de
// itens a lista pode estar cortada e a pagina avisa (E-14).
export const FEEDBACK_LIST_LIMIT = 300;
// Igual a FEEDBACK_REPLY_MAX_LENGTH no backend (moderate-feedback.dto.ts).
export const FEEDBACK_REPLY_MAX_LENGTH = 2000;

export async function getFeedbackList(): Promise<FeedbackItem[]> {
  const response = await api.get<FeedbackItem[]>('/feedback');
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
