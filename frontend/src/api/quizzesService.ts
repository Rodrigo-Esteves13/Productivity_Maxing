import api from './client';
import type { Quiz, QuizQuestion } from '../lib/quizFormat';
import { canonicalQuizText } from '../lib/quizImport';
import type { QuizDiagram } from '../lib/quizDiagram';
import type { QuizMode, QuizStats } from '../lib/quizSession';

export type QuizAttemptModeApi = 'EXAM' | 'PRACTICE' | 'WRONG';

export const MODE_TO_API: Record<QuizMode, QuizAttemptModeApi> = {
  exam: 'EXAM',
  practice: 'PRACTICE',
  wrong: 'WRONG',
};

export interface QuizSummary {
  id: string;
  title: string;
  language: string;
  questionCount: number;
  lastScorePct: number | null;
  createdAt: string;
}

export interface QuizAttemptRecord {
  id: string;
  mode: QuizAttemptModeApi;
  total: number;
  correct: number;
  durationMs: number;
  // Perguntas planeadas; 0 em tentativas antigas. Maior que total = parcial.
  planned?: number;
  finishedAt: string;
}

export interface QuizDetail extends QuizSummary {
  secondsPerQuestion: number;
  topics: string[];
  questions: QuizQuestion[];
  figures: Record<string, QuizDiagram>;
  stats: QuizStats;
  attempts: QuizAttemptRecord[];
}

export interface AttemptResult {
  questionId: string;
  correct: boolean;
}

const url = (id: string) => `/quizzes/${encodeURIComponent(id)}`;

export const listQuizzes = async (): Promise<QuizSummary[]> => (await api.get<QuizSummary[]>('/quizzes')).data;

export const getQuiz = async (id: string): Promise<QuizDetail> => (await api.get<QuizDetail>(url(id))).data;

// Envia o texto canonico do quiz de checkQuizText, feito pela mesma funcao que
// o servidor usa (canonicalQuizText, copia em backend/src/quizzes/quiz-check.ts):
// o servidor volta a verificar tudo e recusa qualquer byte diferente.
export const importQuiz = async (quiz: Quiz): Promise<QuizSummary & { skipped: number }> =>
  (await api.post<QuizSummary & { skipped: number }>('/quizzes/import', { quizJson: canonicalQuizText(quiz) })).data;

export const renameQuiz = async (id: string, title: string): Promise<void> => {
  await api.patch(url(id), { title });
};

export const deleteQuiz = async (id: string): Promise<void> => {
  await api.delete(url(id));
};

export const submitQuizAttempt = async (
  id: string,
  mode: QuizMode,
  durationMs: number,
  results: AttemptResult[],
  planned: number,
): Promise<{ attempt: QuizAttemptRecord; stats: QuizStats; lastScorePct: number }> =>
  (await api.post(`${url(id)}/attempts`, { mode: MODE_TO_API[mode], durationMs, results, planned })).data;
