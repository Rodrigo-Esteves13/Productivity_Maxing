import api from './client';
import type { FeedbackCategory, FeedbackItem } from '../types/models';

export async function sendFeedback(input: {
  category: FeedbackCategory;
  rating?: number;
  message: string;
  language: string;
  page: string;
}): Promise<void> {
  await api.post('/feedback', input);
}

// Admin
// Igual ao take de FeedbackService.list no backend: com este numero de
// itens a lista pode estar cortada e a pagina avisa (E-14).
export const FEEDBACK_LIST_LIMIT = 300;

export async function getFeedbackList(): Promise<FeedbackItem[]> {
  const response = await api.get<FeedbackItem[]>('/feedback');
  return response.data;
}

export async function setFeedbackResolved(id: string, isResolved: boolean): Promise<void> {
  await api.patch(`/feedback/${id}/resolved`, { isResolved });
}
