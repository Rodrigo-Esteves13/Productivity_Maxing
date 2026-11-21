import api from './client';
import type { Flashcard, FlashcardGrade } from '../types/models';

export interface FlashcardInput {
  front: string;
  back: string;
  // null desliga a cadeira.
  areaId: string | null;
}

const url = (id: string) => `/flashcards/${encodeURIComponent(id)}`;

export const getFlashcards = async (): Promise<Flashcard[]> => (await api.get<Flashcard[]>('/flashcards')).data;

export const createFlashcard = async (input: FlashcardInput): Promise<Flashcard> =>
  (await api.post<Flashcard>('/flashcards', input)).data;

export const createFlashcards = async (cards: FlashcardInput[]): Promise<number> =>
  (await api.post<{ created: number }>('/flashcards/bulk', { cards })).data.created;

export const updateFlashcard = async (id: string, input: Partial<FlashcardInput>): Promise<Flashcard> =>
  (await api.patch<Flashcard>(url(id), input)).data;

export const deleteFlashcard = async (id: string): Promise<void> => {
  await api.delete(url(id));
};

export const reviewFlashcard = async (id: string, grade: FlashcardGrade): Promise<Flashcard> =>
  (await api.post<Flashcard>(`${url(id)}/review`, { grade })).data;

export interface FlashcardForecastDay {
  // 'YYYY-MM-DD', hoje primeiro; os atrasados entram no dia 0.
  date: string;
  total: number;
  // Chave = areaId, ou 'none' para cartoes sem cadeira.
  byArea: Record<string, number>;
}

export interface FlashcardForecastExam {
  taskId: string;
  title: string;
  date: string;
  areaId: string;
}

export interface FlashcardForecast {
  days: FlashcardForecastDay[];
  exams: FlashcardForecastExam[];
}

export const getFlashcardForecast = async (): Promise<FlashcardForecast> =>
  (await api.get<FlashcardForecast>('/flashcards/forecast')).data;
