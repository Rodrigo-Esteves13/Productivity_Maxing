// Baralhar e corrigir respostas por tipo de pergunta.

import type { QuizKind, QuizQuestion, QuizResponse } from './quizFormat';
import { foldText } from './textSearch';
import { NO_MATCH } from './quizSessionTypes';

export type Rand = () => number;

export function shuffle<T>(items: readonly T[], rand: Rand = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sorted = (list: readonly number[]) => [...list].sort((x, y) => x - y);

// Compara respostas escritas sem acentos, maiusculas, aspas nem ponto final.
export function normalizeTyped(text: string): string {
  return foldText(text).replace(/["'“”‘’`]/g, '').replace(/\s+/g, ' ').trim().replace(/[.!?;:,]+$/, '').trim();
}

const GRADERS: Record<QuizKind, (q: QuizQuestion, r: QuizResponse) => boolean> = {
  single: (q, r) => sameList(sorted(r.selected), sorted(q.answer)),
  multi: (q, r) => sameList(sorted(r.selected), sorted(q.answer)),
  truefalse: (q, r) => sameList(sorted(r.selected), sorted(q.answer)),
  typed: (q, r) => q.accepted.some((a) => normalizeTyped(a) === normalizeTyped(r.text)),
  order: (q, r) => sameList(r.order, range(q.items.length)),
  match: (q, r) => sameList(r.match, q.pairs),
};

export const gradeQuestion = (q: QuizQuestion, r: QuizResponse): boolean => GRADERS[q.kind](q, r);

const ANSWERED: Record<QuizKind, (r: QuizResponse) => boolean> = {
  single: (r) => r.selected.length > 0,
  multi: (r) => r.selected.length > 0,
  truefalse: (r) => r.selected.length > 0,
  typed: (r) => r.text.trim() !== '',
  order: (r) => r.order.length > 0,
  match: (r) => r.match.length > 0 && r.match.every((m) => m !== NO_MATCH),
};

export const isAnswered = (q: QuizQuestion, r: QuizResponse): boolean => ANSWERED[q.kind](r);
