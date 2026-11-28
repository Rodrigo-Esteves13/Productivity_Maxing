// Leitura e validacao de cada pergunta.

import {
  QUIZ_CODE_MAX,
  QUIZ_EXPLANATION_MAX,
  QUIZ_MAX_ACCEPTED,
  QUIZ_MAX_ITEMS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_ITEMS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX,
  QUIZ_PROMPT_MAX,
  QUIZ_PROMPT_MIN,
  QUIZ_TOPIC_MAX,
  TRUE_FALSE_OPTIONS,
  type QuizKind,
  type QuizQuestion,
} from './quizFormat';
import type { QuizSkipReason } from './quizImportTypes';
import {
  isReservedId,
  type Counters,
  type Figures,
  type Json,
  isObject,
  pick,
  sanitizeQuizText,
  intList,
  textList,
  unique,
} from './quizImportShared';
import { readSources, readFigureRef } from './quizImportMeta';

const QUESTION_ID_MAX = 40;

const KIND_ALIASES: Record<string, QuizKind> = {
  single: 'single',
  multi: 'multi',
  multiple: 'multi',
  truefalse: 'truefalse',
  true_false: 'truefalse',
  tf: 'truefalse',
  typed: 'typed',
  in: 'typed',
  text: 'typed',
  order: 'order',
  ord: 'order',
  match: 'match',
  mat: 'match',
};

function inferKind(q: Json, options: unknown[]): QuizKind | null {
  const raw = pick(q, 'kind', 'k', 'type');
  if (typeof raw === 'string') return KIND_ALIASES[raw.toLowerCase()] ?? null;
  if (raw !== undefined) return null;
  if (options.length === TRUE_FALSE_OPTIONS) return 'truefalse';
  return intList(pick(q, 'answer', 'a', 'correct')).length > 1 ? 'multi' : 'single';
}

const inRange = (list: number[], size: number) => list.every((n) => n >= 0 && n < size) && new Set(list).size === list.length;

// Valida os campos especificos de cada tipo. Devolve o motivo ou null.
function checkKind(q: QuizQuestion): QuizSkipReason | null {
  const { kind, options, answer } = q;
  if (kind === 'single' || kind === 'multi' || kind === 'truefalse') {
    const count = kind === 'truefalse' ? options.length === TRUE_FALSE_OPTIONS : options.length >= QUIZ_MIN_OPTIONS && options.length <= QUIZ_MAX_OPTIONS;
    if (!count || options.some((o) => !o) || !unique(options)) return 'options';
    const answers = kind === 'multi' ? answer.length >= 2 && answer.length < options.length : answer.length === 1;
    return answers && inRange(answer, options.length) ? null : 'answer';
  }
  if (kind === 'typed') return q.accepted.length > 0 && q.accepted.every(Boolean) ? null : 'accepted';
  if (kind === 'order') {
    return q.items.length >= QUIZ_MIN_ITEMS && q.items.length <= QUIZ_MAX_ITEMS && q.items.every(Boolean) && unique(q.items) ? null : 'items';
  }
  const pairsOk = q.pairs.length === q.left.length && q.pairs.every((p) => p >= 0 && p < q.right.length);
  // Varios itens podem ligar a mesma escolha (ex.: classificar em 2 categorias).
  const sizes = q.left.length >= 2 && q.left.length <= QUIZ_MAX_ITEMS && q.right.length >= 2 && q.right.length <= QUIZ_MAX_OPTIONS;
  return sizes && pairsOk && [...q.left, ...q.right].every(Boolean) && unique(q.right) ? null : 'match';
}

// Correspondencia: formato longo (left/right/pairs) ou o do quiz de exemplo
// (c = escolhas, p = [[etiqueta, indice], ...]).
function readMatch(q: Json, counters: Counters): Pick<QuizQuestion, 'left' | 'right' | 'pairs'> {
  const right = textList(pick(q, 'right', 'c'), QUIZ_OPTION_MAX, counters);
  const rawPairs = pick(q, 'pairs', 'p');
  if (Array.isArray(rawPairs) && rawPairs.every((p) => Array.isArray(p))) {
    const tuples = rawPairs as unknown[][];
    return {
      left: tuples.map((p) => sanitizeQuizText(p[0], QUIZ_OPTION_MAX, counters)),
      right,
      pairs: tuples.map((p) => (Number.isInteger(p[1]) ? (p[1] as number) : -1)),
    };
  }
  return { left: textList(pick(q, 'left'), QUIZ_OPTION_MAX, counters), right, pairs: intList(rawPairs ?? []) };
}

export function readQuestion(raw: unknown, index: number, topics: Map<string, string>, figures: Figures, counters: Counters): QuizQuestion | QuizSkipReason {
  if (!isObject(raw)) return 'notObject';
  const rawOptions = pick(raw, 'options', 'o');
  const kind = inferKind(raw, Array.isArray(rawOptions) ? rawOptions : []);
  if (!kind) return 'kind';
  const prompt = sanitizeQuizText(pick(raw, 'prompt', 'q', 'question'), QUIZ_PROMPT_MAX + 1, counters);
  if (prompt.length < QUIZ_PROMPT_MIN || prompt.length > QUIZ_PROMPT_MAX) return 'prompt';
  const rawTopic = pick(raw, 'topic', 't');
  const topicKey = typeof rawTopic === 'string' || typeof rawTopic === 'number' ? String(rawTopic) : '';
  const rawId = pick(raw, 'id');
  const cleanId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).replace(/[^\w-]/g, '').slice(0, QUESTION_ID_MAX) : '';
  // Os ids servem de chave nas estatisticas: nunca uma chave proibida.
  const id = isReservedId(cleanId) ? '' : cleanId;
  const question: QuizQuestion = {
    id: id || `q${index + 1}`,
    topic: topics.get(topicKey) ?? sanitizeQuizText(topicKey, QUIZ_TOPIC_MAX, counters, false),
    kind,
    prompt,
    code: sanitizeQuizText(pick(raw, 'code'), QUIZ_CODE_MAX, counters) || null,
    figure: readFigureRef(raw, index, figures, counters),
    options: textList(rawOptions, QUIZ_OPTION_MAX, counters),
    answer: intList(pick(raw, 'answer', 'a', 'correct')),
    accepted: textList(pick(raw, 'accepted', 'acc'), QUIZ_OPTION_MAX, counters).slice(0, QUIZ_MAX_ACCEPTED),
    items: textList(pick(raw, 'items'), QUIZ_OPTION_MAX, counters),
    ...(kind === 'match' ? readMatch(raw, counters) : { left: [], right: [], pairs: [] }),
    explanation: sanitizeQuizText(pick(raw, 'explanation', 'e'), QUIZ_EXPLANATION_MAX, counters),
    sources: readSources(pick(raw, 'sources', 'src'), counters),
  };
  return checkKind(question) ?? question;
}
