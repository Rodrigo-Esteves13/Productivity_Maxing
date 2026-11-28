// Tipos do relatorio da verificacao de um quiz importado.

import type { Quiz } from './quizFormat';

export type QuizCheckId = 'size' | 'json' | 'structure' | 'format' | 'content' | 'links' | 'figures' | 'questions';
export type QuizCheckStatus = 'pass' | 'warn' | 'fail';

export interface QuizCheck {
  id: QuizCheckId;
  status: QuizCheckStatus;
  count: number;
}

export type QuizSkipReason =
  | 'notObject'
  | 'prompt'
  | 'kind'
  | 'options'
  | 'answer'
  | 'accepted'
  | 'items'
  | 'match'
  | 'duplicate'
  | 'tooMany';

export interface QuizSkip {
  index: number;
  reason: QuizSkipReason;
}

export interface QuizImportReport {
  ok: boolean;
  quiz: Quiz | null;
  checks: QuizCheck[];
  skipped: QuizSkip[];
}
