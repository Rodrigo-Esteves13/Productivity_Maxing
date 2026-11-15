// Logica pura do quiz: correcao por tipo, montar sessoes (exame,
// pratica, erradas), baralhar opcoes por tentativa e estatisticas.
import {
  EMPTY_RESPONSE,
  QUIZ_MAX_ITEMS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  TRUE_FALSE_OPTIONS,
  type Quiz,
  type QuizKind,
  type QuizQuestion,
  type QuizResponse,
} from './quizFormat';
import { foldText } from './textSearch';
import { stripQuizMarkdown } from './quizMarkdown';
import { IMPORT_BACK_MAX, IMPORT_FRONT_MAX } from './flashcardImport';

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

type Rand = () => number;

export function shuffle<T>(items: readonly T[], rand: Rand = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
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

// Baralha sem devolver a ordem certa (senao uma ordenacao ja vinha feita).
function shuffledNotIdentity(n: number, rand: Rand): number[] {
  const out = shuffle(range(n), rand);
  return n > 1 && sameList(out, range(n)) ? [...out.slice(1), out[0]] : out;
}

export function makeItem(q: QuizQuestion, rand: Rand = Math.random): SessionItem {
  const base = { id: q.id, flagged: false, checked: false, timeMs: 0 };
  // Verdadeiro/falso fica sempre pela mesma ordem; o resto e baralhado por
  // tentativa (as IAs tendem a por a certa nas primeiras posicoes).
  const options = q.kind === 'truefalse' && q.options.length === TRUE_FALSE_OPTIONS ? range(TRUE_FALSE_OPTIONS) : shuffle(range(q.options.length), rand);
  const perm = q.kind === 'match' ? shuffle(range(q.right.length), rand) : options;
  const response: QuizResponse = {
    ...EMPTY_RESPONSE,
    order: q.kind === 'order' ? shuffledNotIdentity(q.items.length, rand) : [],
    match: q.kind === 'match' ? q.left.map(() => NO_MATCH) : [],
  };
  return { ...base, perm, response };
}

export function startSession(
  mode: QuizMode,
  questions: QuizQuestion[],
  secondsPerQuestion: number,
  now: number = Date.now(),
  rand: Rand = Math.random,
): QuizSession {
  const items = questions.map((q) => makeItem(q, rand));
  const deadline = mode === 'exam' ? now + items.length * secondsPerQuestion * MS_PER_SECOND : null;
  return { mode, items, index: 0, startedAt: now, deadline, finishedAt: null, activeMs: 0, lastActiveAt: now, lastSeenAt: now };
}

// ---------------------------------------------------------------------------
// Historico inteligente. Contrato usado por QuizRunner, QuizDetail e o backend
// (QuizAttempt.planned):
// - touchSession em cada interacao: soma o tempo desde a ultima, no maximo
//   QUIZ_IDLE_GAP_MS (10 min parado numa pergunta conta 2 min).
// - heartbeatSession a cada QUIZ_HEARTBEAT_MS enquanto a pagina esta aberta.
// - resumeSession ao voltar a abrir a tentativa: se a pagina esteve fechada
//   (salto > QUIZ_HEARTBEAT_GRACE_MS), o relogio do exame fica parado esse tempo.
// - classifyAttempt no fim: 'discard' (curta demais ou sem respostas, nao grava),
//   'partial' (so as respondidas contam) ou 'complete' (em branco conta errada).
// ---------------------------------------------------------------------------
export const QUIZ_IDLE_GAP_MS = 2 * 60 * MS_PER_SECOND;
export const QUIZ_HEARTBEAT_MS = 5 * MS_PER_SECOND;
export const QUIZ_HEARTBEAT_GRACE_MS = 20 * MS_PER_SECOND;
export const QUIZ_MIN_ATTEMPT_MS = 15 * MS_PER_SECOND;
export const QUIZ_MIN_ANSWERED = 1;

export type AttemptOutcome = 'complete' | 'partial' | 'discard';

export function touchSession(session: QuizSession, now: number = Date.now()): QuizSession {
  const last = session.lastActiveAt ?? session.startedAt;
  const gap = Math.max(0, Math.min(now - last, QUIZ_IDLE_GAP_MS));
  return { ...session, activeMs: (session.activeMs ?? 0) + gap, lastActiveAt: now, lastSeenAt: now };
}

export const heartbeatSession = (session: QuizSession, now: number = Date.now()): QuizSession => ({ ...session, lastSeenAt: now });

export function resumeSession(session: QuizSession, now: number = Date.now()): QuizSession {
  const seen = session.lastSeenAt ?? session.lastActiveAt ?? now;
  const away = now - seen;
  if (away <= QUIZ_HEARTBEAT_GRACE_MS) return session;
  // Pagina fechada: o exame nao gasta tempo, e a pausa nao conta como ativa.
  return {
    ...session,
    deadline: session.deadline === null ? null : session.deadline + away,
    lastActiveAt: now,
    lastSeenAt: now,
  };
}

// Respondida de verdade: na pratica confirmada; no exame mexida e completa.
export function wasAnswered(question: QuizQuestion, item: SessionItem, mode: QuizMode): boolean {
  if (mode !== 'exam') return item.checked;
  return (item.touched ?? false) && isAnswered(question, item.response);
}

export interface AttemptClassification {
  outcome: AttemptOutcome;
  answeredIds: string[];
  activeMs: number;
  planned: number;
}

export function classifyAttempt(quiz: Quiz, session: QuizSession, now: number = Date.now()): AttemptClassification {
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const answeredIds = session.items.flatMap((item) => {
    const q = byId.get(item.id);
    return q && wasAnswered(q, item, session.mode) ? [item.id] : [];
  });
  const activeMs = touchSession(session, now).activeMs ?? 0;
  const planned = session.items.length;
  if (answeredIds.length < QUIZ_MIN_ANSWERED || activeMs < QUIZ_MIN_ATTEMPT_MS) return { outcome: 'discard', answeredIds, activeMs, planned };
  // Exame que acabou o tempo com o aluno presente: tudo conta (em branco = errada).
  const lastActive = session.lastActiveAt ?? session.startedAt;
  const timedOutWhileActive = session.deadline !== null && now >= session.deadline && session.deadline - lastActive <= QUIZ_IDLE_GAP_MS;
  const outcome = answeredIds.length === planned || timedOutWhileActive ? 'complete' : 'partial';
  return { outcome, answeredIds, activeMs, planned };
}

// Tentativa parcial: so as perguntas respondidas entram na nota e no historico.
export function answeredOnly(session: QuizSession, answeredIds: readonly string[]): QuizSession {
  const keep = new Set(answeredIds);
  return { ...session, items: session.items.filter((item) => keep.has(item.id)) };
}

// Perguntas erradas ja enviadas para as flashcards (por quiz, neste dispositivo),
// para nao oferecer o mesmo cartao duas vezes.
export const QUIZ_CARDS_SENT_MAX_IDS = 500;
export const QUIZ_CARDS_SENT_MAX_QUIZZES = 50;

export const mergeSentIds = (prev: readonly string[], added: readonly string[], max: number = QUIZ_CARDS_SENT_MAX_IDS): string[] =>
  [...new Set([...prev, ...added])].slice(-max);

export function pickExam(quiz: Quiz, size: number, rand: Rand = Math.random): QuizQuestion[] {
  return shuffle(quiz.questions, rand).slice(0, size);
}

export function pickPractice(quiz: Quiz, topics: string[], kinds: QuizKind[], size: number, rand: Rand = Math.random): QuizQuestion[] {
  const pool = quiz.questions.filter(
    (q) => (topics.length === 0 || topics.includes(q.topic)) && (kinds.length === 0 || kinds.includes(q.kind)),
  );
  return shuffle(pool, rand).slice(0, size);
}

export const wrongQuestions = (quiz: Quiz, stats: QuizStats): QuizQuestion[] =>
  quiz.questions.filter((q) => statOf(stats, q.id)?.last === false);

export interface SessionScore {
  correct: number;
  total: number;
  percent: number;
  results: { question: QuizQuestion; item: SessionItem; right: boolean }[];
}

export function scoreSession(quiz: Quiz, session: QuizSession): SessionScore {
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const results = session.items.flatMap((item) => {
    const question = byId.get(item.id);
    return question ? [{ question, item, right: gradeQuestion(question, item.response) }] : [];
  });
  const correct = results.filter((r) => r.right).length;
  const total = results.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100), results };
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
}

export function scoreByTopic(score: SessionScore): TopicScore[] {
  const map = new Map<string, TopicScore>();
  score.results.forEach(({ question, right }) => {
    const entry = map.get(question.topic) ?? { topic: question.topic, correct: 0, total: 0 };
    entry.total += 1;
    entry.correct += right ? 1 : 0;
    map.set(question.topic, entry);
  });
  return [...map.values()];
}

// So conta perguntas respondidas (as que ficaram em branco no exame contam
// como erradas, como no exemplo).
export function applyScore(stats: QuizStats, score: SessionScore): QuizStats {
  // Map + fromEntries: um id como "__proto__" nunca mexe no prototipo.
  const next = new Map(Object.entries(stats));
  score.results.forEach(({ question, right }) => {
    const prev = next.get(question.id) ?? { seen: 0, correct: 0, last: false };
    next.set(question.id, { seen: prev.seen + 1, correct: prev.correct + (right ? 1 : 0), last: right });
  });
  return Object.fromEntries(next);
}

export interface TopicMastery {
  topic: string;
  total: number;
  right: number;
  wrong: number;
}

export function topicMastery(quiz: Quiz, stats: QuizStats): TopicMastery[] {
  return quiz.topics.map((topic) => {
    const qs = quiz.questions.filter((q) => q.topic === topic);
    const right = qs.filter((q) => statOf(stats, q.id)?.last === true).length;
    const wrong = qs.filter((q) => statOf(stats, q.id)?.last === false).length;
    return { topic, total: qs.length, right, wrong };
  });
}

// Texto da resposta certa (para a revisao e para as flashcards).
export function correctAnswerText(q: QuizQuestion): string {
  const ANSWER_TEXT: Record<QuizKind, () => string> = {
    single: () => q.answer.map((i) => q.options[i]).join('\n'),
    multi: () => q.answer.map((i) => q.options[i]).join('\n'),
    truefalse: () => q.answer.map((i) => q.options[i]).join('\n'),
    typed: () => q.accepted[0] ?? '',
    order: () => q.items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
    match: () => q.left.map((l, i) => `${l}: ${q.right[q.pairs[i]]}`).join('\n'),
  };
  return ANSWER_TEXT[q.kind]();
}

// Item ja com a resposta certa (banco de perguntas: mostrar a chave).
export function answerKeyItem(q: QuizQuestion): SessionItem {
  return {
    id: q.id,
    perm: range(q.kind === 'match' ? q.right.length : q.options.length),
    response: { selected: q.answer, text: q.accepted[0] ?? '', order: range(q.items.length), match: q.pairs },
    flagged: false,
    checked: true,
    timeMs: 0,
  };
}

const ELLIPSIS = '...';
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - ELLIPSIS.length).replace(/\s+\S*$/, '')}${ELLIPSIS}`);

// Pergunta errada vira cartao: frente = enunciado, verso = resposta certa
// e explicacao (sem marcas de markdown, cortado nos limites dos cartoes).
export function quizQuestionsToCards(questions: QuizQuestion[]): { front: string; back: string }[] {
  return questions.map((q) => ({
    front: clip(stripQuizMarkdown([q.prompt, q.code].filter(Boolean).join('\n')), IMPORT_FRONT_MAX),
    back: clip(stripQuizMarkdown([correctAnswerText(q), q.explanation].filter(Boolean).join('\n\n')), IMPORT_BACK_MAX),
  }));
}

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
