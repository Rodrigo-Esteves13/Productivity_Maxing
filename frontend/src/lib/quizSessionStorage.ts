// Leitura segura da sessao guardada e ordenacao por arrasto.

import {
  QUIZ_MAX_ITEMS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  type Quiz,
  type QuizQuestion,
  type QuizResponse,
} from './quizFormat';
import { type QuizMode, QUIZ_MODES, NO_MATCH, type SessionItem, type QuizSession } from './quizSessionTypes';

// ---------------------------------------------------------------------------
// Sessao guardada no localStorage: nunca confiar no que la esta. Qualquer
// desvio da forma (ou um indice fora do quiz) descarta a sessao inteira.
// ---------------------------------------------------------------------------
export const SESSION_MAX_ITEMS = QUIZ_MAX_QUESTIONS;
export const SESSION_MAX_INDEX_LIST = Math.max(QUIZ_MAX_OPTIONS, QUIZ_MAX_ITEMS);
export const SESSION_MAX_TEXT = 10_000;

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOptionalFinite = (value: unknown): boolean => value === undefined || isFiniteNumber(value);

function isIndexList(value: unknown, min: number): value is number[] {
  return Array.isArray(value) && value.length <= SESSION_MAX_INDEX_LIST && value.every((n) => Number.isSafeInteger(n) && n >= min);
}

function parseResponse(raw: unknown): QuizResponse | null {
  if (!isRecord(raw)) return null;
  const { selected, order, match, text } = raw;
  if (!isIndexList(selected, 0) || !isIndexList(order, 0) || !isIndexList(match, NO_MATCH)) return null;
  return typeof text === 'string' && text.length <= SESSION_MAX_TEXT ? { selected, order, match, text } : null;
}

function parseItem(raw: unknown): SessionItem | null {
  if (!isRecord(raw)) return null;
  const { id, perm, flagged, checked, timeMs, touched } = raw;
  const response = parseResponse(raw.response);
  if (typeof id !== 'string' || !isIndexList(perm, 0) || !response) return null;
  if (typeof flagged !== 'boolean' || typeof checked !== 'boolean' || !isFiniteNumber(timeMs)) return null;
  if (touched !== undefined && typeof touched !== 'boolean') return null;
  const item: SessionItem = { id, perm, response, flagged, checked, timeMs };
  return touched === undefined ? item : { ...item, touched };
}

// questionIds: ids do quiz aberto (null = ainda sem quiz, so valida a forma).
export function parseStoredSession(raw: unknown, questionIds: Set<string> | null): QuizSession | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  if (raw.items.length === 0 || raw.items.length > SESSION_MAX_ITEMS) return null;
  const parsed = raw.items.map(parseItem);
  const items = parsed.filter((item): item is SessionItem => item !== null);
  const { mode, index, startedAt, deadline, finishedAt, activeMs, lastActiveAt, lastSeenAt } = raw;
  if (items.length !== parsed.length || typeof mode !== 'string' || !QUIZ_MODES.includes(mode as QuizMode)) return null;
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= items.length) return null;
  if (!isFiniteNumber(startedAt) || (deadline !== null && !isFiniteNumber(deadline)) || (finishedAt !== null && !isFiniteNumber(finishedAt))) return null;
  if (!isOptionalFinite(activeMs) || !isOptionalFinite(lastActiveAt) || !isOptionalFinite(lastSeenAt)) return null;
  if (new Set(items.map((item) => item.id)).size !== items.length) return null;
  if (questionIds && items.some((item) => !questionIds.has(item.id))) return null;
  return {
    mode: mode as QuizMode,
    items,
    index,
    startedAt,
    deadline: deadline as number | null,
    finishedAt: finishedAt as number | null,
    ...(activeMs === undefined ? {} : { activeMs: activeMs as number }),
    ...(lastActiveAt === undefined ? {} : { lastActiveAt: lastActiveAt as number }),
    ...(lastSeenAt === undefined ? {} : { lastSeenAt: lastSeenAt as number }),
  };
}

const allBelow = (list: readonly number[], limit: number, min = 0) => list.every((n) => n >= min && n < limit);

// A sessao cabe no quiz carregado: os ids existem e todos os indices apontam
// para opcoes, itens ou colunas que existem nessa pergunta.
export function sessionFitsQuiz(session: QuizSession, quiz: Pick<Quiz, 'questions'>): boolean {
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  return session.items.every((item) => {
    const q = byId.get(item.id);
    if (!q) return false;
    const { selected, order, match } = item.response;
    return (
      allBelow(item.perm, q.kind === 'match' ? q.right.length : q.options.length) &&
      allBelow(selected, q.options.length) &&
      allBelow(order, q.items.length) &&
      allBelow(match, q.right.length, NO_MATCH) &&
      match.length <= q.left.length
    );
  });
}

// Ordenar por arrasto: tira o item de `from` e mete-o em `to` (os outros deslizam).
export function moveOrder(list: readonly number[], from: number, to: number): number[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Posicao onde largar: quantas das outras linhas tem o meio acima do ponteiro.
export function dropIndex(otherMidpoints: readonly number[], pointerY: number): number {
  return otherMidpoints.filter((mid) => mid < pointerY).length;
}

// Resposta guardada neste dispositivo (ultima errada): mesma validacao da sessao.
export const parseStoredResponse = (raw: unknown): QuizResponse | null => parseResponse(raw);

// A resposta so aponta para opcoes, itens e colunas que existem nesta pergunta.
export function responseFitsQuestion(q: QuizQuestion, r: QuizResponse): boolean {
  return (
    allBelow(r.selected, q.options.length) &&
    allBelow(r.order, q.items.length) &&
    allBelow(r.match, q.right.length, NO_MATCH) &&
    r.match.length <= q.left.length
  );
}
