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
export async function getFeedbackList(): Promise<FeedbackItem[]> {
  const response = await api.get<FeedbackItem[]>('/feedback');
  return response.data;
}

export async function setFeedbackResolved(id: string, isResolved: boolean): Promise<void> {
  await api.patch(`/feedback/${id}/resolved`, { isResolved });
}
