// Tipos e constantes base de uma sessao de quiz.

import type { QuizResponse } from './quizFormat';

export type QuizMode = 'exam' | 'practice' | 'wrong';
export const QUIZ_MODES: QuizMode[] = ['exam', 'practice', 'wrong'];
export const EXAM_SIZES = [15, 25, 40] as const;
export const PRACTICE_SIZES = [10, 20, 50] as const;
export const NO_MATCH = -1;
export const MS_PER_SECOND = 1000;

export interface SessionItem {
  id: string;
  // Ordem mostrada das opcoes (escolha) ou da coluna da direita (match).
  perm: number[];
  response: QuizResponse;
  flagged: boolean;
  // Pratica: resposta ja confirmada (feedback imediato).
  checked: boolean;
  timeMs: number;
  // O aluno mexeu nesta resposta (uma pergunta de ordenar ja vem preenchida).
  touched?: boolean;
}

export interface QuizSession {
  mode: QuizMode;
  items: SessionItem[];
  index: number;
  startedAt: number;
  // Exame: fim do tempo (epoch ms). null = sem tempo.
  deadline: number | null;
  finishedAt: number | null;
  // Tempo ativo: pausas longas contam no maximo QUIZ_IDLE_GAP_MS (ver touchSession).
  activeMs?: number;
  // Ultima interacao do aluno (epoch ms).
  lastActiveAt?: number;
  // Ultimo sinal de vida da pagina (heartbeat). Um salto grande = site fechado.
  lastSeenAt?: number;
}

export interface QuestionStat {
  seen: number;
  correct: number;
  last: boolean;
  // Tempo ativo somado a responder (ms) e quantas respostas trouxeram tempo.
  timeMs?: number;
  timed?: number;
  // Relogio do servidor (epoch ms), 0 = nunca.
  lastAt?: number;
  wrongAt?: number;
  // Tirada da lista de erradas pelo aluno; volta a entrar ao errar outra vez.
  dismissed?: boolean;
}
export type QuizStats = Record<string, QuestionStat>;

// Ids vem de ficheiros externos: "toString" nao pode apanhar o valor herdado.
export const statOf = (stats: QuizStats, id: string): QuestionStat | undefined => (Object.hasOwn(stats, id) ? stats[id] : undefined);

export interface QuizAttemptSummary {
  at: number;
  mode: QuizMode;
  total: number;
  correct: number;
  durationMs: number;
}
