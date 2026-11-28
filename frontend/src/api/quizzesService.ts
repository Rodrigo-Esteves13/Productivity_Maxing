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
  // Copia de um quiz partilhado: quem o fez (so o autor volta a partilhar).
  sharedBy?: { name: string } | null;
  // O autor tem um link de partilha ativo.
  isShared?: boolean;
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
  // Geradores de calculo ligados neste quiz (lib/quizGenerators); antigos nao trazem.
  generators?: string[];
  // Cadeira e task para que se estuda com este quiz (sessao de foco).
  areaId?: string | null;
  taskId?: string | null;
  area?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
}

export interface AttemptResult {
  questionId: string;
  correct: boolean;
  // Tempo ativo nesta pergunta (ms).
  timeMs?: number;
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

// Apaga o historico de tentativas deste quiz.
export const clearQuizAttempts = async (id: string): Promise<void> => {
  await api.delete(`${url(id)}/attempts`);
};

// Apaga uma so tentativa do historico.
export const deleteQuizAttempt = async (id: string, attemptId: string): Promise<void> => {
  await api.delete(`${url(id)}/attempts/${encodeURIComponent(attemptId)}`);
};

// Repoe o dominio (estatisticas por pergunta) a zero.
export const resetQuizStats = async (id: string): Promise<void> => {
  await api.delete(`${url(id)}/stats`);
};

// Tira perguntas da area de erradas (todas, ou so uma).
export const dismissQuizWrong = async (id: string, questionId?: string): Promise<void> => {
  await api.delete(questionId ? `${url(id)}/wrong/${encodeURIComponent(questionId)}` : `${url(id)}/wrong`);
};

// Liga ou desliga os geradores de calculo deste quiz.
export const updateQuizGenerators = async (id: string, generators: string[]): Promise<void> => {
  await api.patch(url(id), { generators });
};

// Liga o quiz a uma cadeira e (opcional) a uma task; null desliga.
export const updateQuizLinks = async (id: string, links: { areaId: string | null; taskId: string | null }): Promise<void> => {
  await api.patch(url(id), links);
};

// Partilha so dentro da app: quem recebe entra e fica com uma copia na conta.
// Nao ha exportacao de perguntas em lado nenhum.
export interface QuizShareRecipient {
  id: string;
  userId: string;
  name: string;
  addedAt: string | null;
  createdAt: string;
}

export interface QuizShareStatus {
  token: string | null;
  copyCount: number;
  createdAt: string | null;
  recipients: QuizShareRecipient[];
}

export interface QuizSharePreview {
  title: string;
  ownerName: string;
  questionCount: number;
  topics: string[];
  language: string;
  generatorCount: number;
  isOwner: boolean;
  addedQuizId: string | null;
}

export interface QuizSharedWithMe {
  token: string;
  title: string;
  ownerName: string;
  questionCount: number;
  topics: string[];
  sharedAt: string;
  addedQuizId: string | null;
}

export interface MyQuizShare {
  quizId: string;
  title: string;
  token: string;
  copyCount: number;
  recipientCount: number;
  createdAt: string;
}

const sharedUrl = (token: string) => `/quizzes/shared/${encodeURIComponent(token)}`;

export const getQuizShare = async (id: string): Promise<QuizShareStatus> => (await api.get<QuizShareStatus>(`${url(id)}/share`)).data;

export const createQuizShare = async (id: string): Promise<QuizShareStatus> => (await api.post<QuizShareStatus>(`${url(id)}/share`)).data;

export const revokeQuizShare = async (id: string): Promise<void> => {
  await api.delete(`${url(id)}/share`);
};

export const shareQuizWithFriend = async (id: string, userId: string): Promise<QuizShareStatus> =>
  (await api.post<QuizShareStatus>(`${url(id)}/share/friends`, { userId })).data;

export const removeQuizShareRecipient = async (id: string, recipientId: string): Promise<void> => {
  await api.delete(`${url(id)}/share/friends/${encodeURIComponent(recipientId)}`);
};

export const previewSharedQuiz = async (token: string): Promise<QuizSharePreview> => (await api.get<QuizSharePreview>(sharedUrl(token))).data;

export const addSharedQuiz = async (token: string): Promise<{ id: string }> => (await api.post<{ id: string }>(`${sharedUrl(token)}/add`)).data;

export const getQuizzesSharedWithMe = async (): Promise<QuizSharedWithMe[]> => (await api.get<QuizSharedWithMe[]>('/quizzes/shared/with-me')).data;

export const getMyQuizShares = async (): Promise<MyQuizShare[]> => (await api.get<MyQuizShare[]>('/quizzes/shared/mine')).data;
