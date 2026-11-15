// Copia da verificacao do frontend (frontend/src/lib/quizImport.ts). O
// servidor nunca confia no que o browser ja limpou: volta a correr tudo
// antes de gravar e so aceita o quiz se ja vier na forma canonica
// (recheckCanonicalQuiz). Manter as duas em sincronia.
import {
  QUIZ_CODE_MAX,
  QUIZ_DEFAULT_SECONDS_PER_QUESTION,
  QUIZ_EXPLANATION_MAX,
  QUIZ_FIGURE_ID_MAX,
  QUIZ_FORMAT_ID,
  QUIZ_FORMAT_VERSION,
  QUIZ_LANGUAGE_MAX,
  QUIZ_MAX_ACCEPTED,
  QUIZ_MAX_DEPTH,
  QUIZ_MAX_FIGURES,
  QUIZ_MAX_FILE_BYTES,
  QUIZ_MAX_ITEMS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MAX_SECONDS_PER_QUESTION,
  QUIZ_MAX_SOURCES,
  QUIZ_MAX_TOPICS,
  QUIZ_MIN_ITEMS,
  QUIZ_MIN_OPTIONS,
  QUIZ_MIN_SECONDS_PER_QUESTION,
  QUIZ_OPTION_MAX,
  QUIZ_PROMPT_MAX,
  QUIZ_PROMPT_MIN,
  QUIZ_SOURCE_TITLE_MAX,
  QUIZ_TITLE_MAX,
  QUIZ_TOPIC_MAX,
  QUIZ_URL_MAX,
  TRUE_FALSE_OPTIONS,
  type Quiz,
  type QuizKind,
  type QuizQuestion,
  type QuizSource,
} from './quiz-format';
import { sanitizeQuizDiagram, type QuizDiagram } from './quiz-diagram';
import { cleanQuizText, stripUnsafeChars } from './quiz-text';

const MARKS = /\p{M}/gu;
const foldText = (text: string): string =>
  text.normalize('NFD').replace(MARKS, '').toLowerCase();

export type QuizCheckId =
  | 'size'
  | 'json'
  | 'structure'
  | 'format'
  | 'content'
  | 'links'
  | 'figures'
  | 'questions';
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

// Chaves que nunca podem aparecer (poluicao de prototipos), nem como ids.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Ids de perguntas e figuras servem de chave (estatisticas, figuras): nunca um
// nome herdado de Object.prototype ("toString", "valueOf", "hasOwnProperty"...).
const isReservedId = (id: string): boolean =>
  FORBIDDEN_KEYS.has(id) || id in Object.prototype;
// Bloco ```json de uma resposta de chat (procurado com indexOf, sem regex).
const FENCE = '```';
const FENCE_LANG = 'json';
const CLOSING_FENCE = `\n${FENCE}`;
const WHITESPACE = /\s/;
const QUESTION_ID_MAX = 40;
// So https: http (sem TLS) conta como ligacao recusada.
const SAFE_PROTOCOL = 'https:';

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

interface Counters {
  dangerous: number;
  badLinks: number;
  // Figuras recusadas, partes retiradas de figuras e referencias sem figura.
  badFigures: number;
}

// Figuras lidas do quiz: id -> diagrama canonico. As usadas passam para o quiz final.
type Figures = Map<string, QuizDiagram>;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const pick = (obj: Json, ...keys: string[]): unknown =>
  keys.map((k) => obj[k]).find((v) => v !== undefined);

// Texto limpo: HTML conhecido passa a markdown minimo, o resto sai.
export function sanitizeQuizText(
  raw: unknown,
  max: number,
  counters?: Counters,
  multiline = true,
): string {
  const { text, dangerous } = cleanQuizText(raw, max, {
    multiline,
    markdown: true,
  });
  if (dangerous && counters) counters.dangerous += 1;
  return text;
}

function safeUrl(raw: unknown, counters: Counters): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === SAFE_PROTOCOL && url.href.length <= QUIZ_URL_MAX)
      return url.href;
  } catch {
    // Cai para o contador abaixo.
  }
  counters.badLinks += 1;
  return null;
}

function depthOk(value: unknown, depth = 0): boolean {
  if (depth > QUIZ_MAX_DEPTH) return false;
  if (Array.isArray(value)) return value.every((v) => depthOk(v, depth + 1));
  if (isObject(value))
    return Object.values(value).every((v) => depthOk(v, depth + 1));
  return true;
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!isObject(value)) return false;
  return Object.keys(value).some(
    (k) => FORBIDDEN_KEYS.has(k) || hasForbiddenKey(value[k]),
  );
}

// Conteudo do primeiro bloco ```json (ou ```) com quebra de linha depois da
// abertura, ate ao proximo "\n```". Linear: cada parte do texto e lida uma vez
// (um regex com [\s\S]*? voltava a percorrer o texto a cada abertura).
function fencedBlock(text: string): string | null {
  for (
    let open = text.indexOf(FENCE);
    open !== -1;
    open = text.indexOf(FENCE, open + 1)
  ) {
    let i = open + FENCE.length;
    const lang = text.slice(i, i + FENCE_LANG.length);
    if (lang.toLowerCase() === FENCE_LANG) i += FENCE_LANG.length;
    // O conteudo comeca depois da ultima quebra de linha dos espacos seguintes.
    let start = -1;
    for (; i < text.length && WHITESPACE.test(text[i]); i += 1)
      if (text[i] === '\n') start = i + 1;
    if (start !== -1) {
      // Sem fecho depois desta abertura tambem nao ha depois das seguintes.
      const end = text.indexOf(CLOSING_FENCE, start);
      return end === -1 ? null : text.slice(start, end);
    }
  }
  return null;
}

// JSON puro, ou dentro de um bloco ```json (resposta colada de um chat).
export function parseQuizJson(text: string): unknown {
  const clean = stripUnsafeChars(text).trim();
  try {
    return JSON.parse(clean);
  } catch {
    const fenced = fencedBlock(clean);
    if (fenced === null) return undefined;
    try {
      return JSON.parse(fenced);
    } catch {
      return undefined;
    }
  }
}

const intList = (raw: unknown): number[] =>
  (Array.isArray(raw) ? raw : [raw]).filter((n): n is number =>
    Number.isInteger(n),
  );

const textList = (raw: unknown, max: number, counters: Counters): string[] =>
  Array.isArray(raw) ? raw.map((v) => sanitizeQuizText(v, max, counters)) : [];

const unique = (values: string[]) =>
  new Set(values.map((v) => foldText(v))).size === values.length;

function readTopics(raw: unknown, counters: Counters): Map<string, string> {
  const map = new Map<string, string>();
  const add = (id: unknown, name: unknown) => {
    const label = sanitizeQuizText(name ?? id, QUIZ_TOPIC_MAX, counters, false);
    if (label && map.size < QUIZ_MAX_TOPICS) map.set(String(id), label);
  };
  if (Array.isArray(raw)) {
    raw.forEach((t) =>
      isObject(t)
        ? add(pick(t, 'id', 'name'), pick(t, 'name', 'label', 'id'))
        : add(t, t),
    );
  } else if (isObject(raw)) {
    Object.entries(raw).forEach(([id, name]) => add(id, name));
  }
  return map;
}

function readSources(raw: unknown, counters: Counters): QuizSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, QUIZ_MAX_SOURCES).flatMap((s): QuizSource[] => {
    const url = safeUrl(isObject(s) ? pick(s, 'url', 'href') : s, counters);
    const title = sanitizeQuizText(
      isObject(s) ? pick(s, 'title', 'name') : '',
      QUIZ_SOURCE_TITLE_MAX,
      counters,
      false,
    );
    if (!url && !title) return [];
    // Sem titulo fica o dominio, limpo como os outros textos (pode passar do maximo).
    return [
      {
        title:
          title ||
          sanitizeQuizText(
            url ? new URL(url).hostname : '',
            QUIZ_SOURCE_TITLE_MAX,
            counters,
            false,
          ),
        url,
      },
    ];
  });
}

// Id vazio (recusado) se o resultado fosse uma chave proibida (ex.: "__proto__!").
function figureId(raw: string): string {
  const id = raw.replace(/[^\w-]/g, '').slice(0, QUIZ_FIGURE_ID_MAX);
  return isReservedId(id) ? '' : id;
}

// Id livre para uma figura inline: nunca substitui uma figura ja lida.
function freeFigureId(figures: Figures, base: string): string {
  let id = base;
  for (let n = 2; figures.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

function addFigure(
  figures: Figures,
  id: string,
  raw: unknown,
  counters: Counters,
): string | null {
  if (!id || figures.size >= QUIZ_MAX_FIGURES) {
    counters.badFigures += 1;
    return null;
  }
  const { diagram, removed } = sanitizeQuizDiagram(raw);
  counters.badFigures += removed + (diagram ? 0 : 1);
  if (!diagram) return null;
  figures.set(id, diagram);
  return id;
}

function readFigures(raw: unknown, counters: Counters): Figures {
  const figures: Figures = new Map();
  if (isObject(raw))
    Object.entries(raw).forEach(([id, diagram]) =>
      addFigure(figures, figureId(id), diagram, counters),
    );
  return figures;
}

// "figure": id de uma figura, o proprio diagrama (objeto), ou ["id"] como no quiz de exemplo.
function readFigureRef(
  q: Json,
  index: number,
  figures: Figures,
  counters: Counters,
): string | null {
  // 'd' so conta como figura quando e uma lista (formato de exemplo); "d": "hard" e dificuldade.
  const rawD = Array.isArray(q.d) ? q.d : undefined;
  const raw = pick(q, 'figure', 'fig') ?? rawD;
  const ref: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  if (ref === undefined || ref === null || ref === '') return null;
  if (isObject(ref))
    return addFigure(
      figures,
      freeFigureId(figures, `q${index + 1}-figure`),
      ref,
      counters,
    );
  const id = typeof ref === 'string' ? figureId(ref) : '';
  if (figures.has(id)) return id;
  counters.badFigures += 1;
  return null;
}

function inferKind(q: Json, options: unknown[]): QuizKind | null {
  const raw = pick(q, 'kind', 'k', 'type');
  if (typeof raw === 'string') return KIND_ALIASES[raw.toLowerCase()] ?? null;
  if (raw !== undefined) return null;
  if (options.length === TRUE_FALSE_OPTIONS) return 'truefalse';
  return intList(pick(q, 'answer', 'a', 'correct')).length > 1
    ? 'multi'
    : 'single';
}

const inRange = (list: number[], size: number) =>
  list.every((n) => n >= 0 && n < size) && new Set(list).size === list.length;

// Valida os campos especificos de cada tipo. Devolve o motivo ou null.
function checkKind(q: QuizQuestion): QuizSkipReason | null {
  const { kind, options, answer } = q;
  if (kind === 'single' || kind === 'multi' || kind === 'truefalse') {
    const count =
      kind === 'truefalse'
        ? options.length === TRUE_FALSE_OPTIONS
        : options.length >= QUIZ_MIN_OPTIONS &&
          options.length <= QUIZ_MAX_OPTIONS;
    if (!count || options.some((o) => !o) || !unique(options)) return 'options';
    const answers =
      kind === 'multi'
        ? answer.length >= 2 && answer.length < options.length
        : answer.length === 1;
    return answers && inRange(answer, options.length) ? null : 'answer';
  }
  if (kind === 'typed')
    return q.accepted.length > 0 && q.accepted.every(Boolean)
      ? null
      : 'accepted';
  if (kind === 'order') {
    return q.items.length >= QUIZ_MIN_ITEMS &&
      q.items.length <= QUIZ_MAX_ITEMS &&
      q.items.every(Boolean) &&
      unique(q.items)
      ? null
      : 'items';
  }
  const pairsOk =
    q.pairs.length === q.left.length &&
    q.pairs.every((p) => p >= 0 && p < q.right.length);
  // Varios itens podem ligar a mesma escolha (ex.: classificar em 2 categorias).
  const sizes =
    q.left.length >= 2 &&
    q.left.length <= QUIZ_MAX_ITEMS &&
    q.right.length >= 2 &&
    q.right.length <= QUIZ_MAX_OPTIONS;
  return sizes &&
    pairsOk &&
    [...q.left, ...q.right].every(Boolean) &&
    unique(q.right)
    ? null
    : 'match';
}

// Correspondencia: formato longo (left/right/pairs) ou o do quiz de exemplo
// (c = escolhas, p = [[etiqueta, indice], ...]).
function readMatch(
  q: Json,
  counters: Counters,
): Pick<QuizQuestion, 'left' | 'right' | 'pairs'> {
  const right = textList(pick(q, 'right', 'c'), QUIZ_OPTION_MAX, counters);
  const rawPairs = pick(q, 'pairs', 'p');
  if (Array.isArray(rawPairs) && rawPairs.every((p) => Array.isArray(p))) {
    const tuples = rawPairs as unknown[][];
    return {
      left: tuples.map((p) =>
        sanitizeQuizText(p[0], QUIZ_OPTION_MAX, counters),
      ),
      right,
      pairs: tuples.map((p) =>
        Number.isInteger(p[1]) ? (p[1] as number) : -1,
      ),
    };
  }
  return {
    left: textList(pick(q, 'left'), QUIZ_OPTION_MAX, counters),
    right,
    pairs: intList(rawPairs ?? []),
  };
}

function readQuestion(
  raw: unknown,
  index: number,
  topics: Map<string, string>,
  figures: Figures,
  counters: Counters,
): QuizQuestion | QuizSkipReason {
  if (!isObject(raw)) return 'notObject';
  const rawOptions = pick(raw, 'options', 'o');
  const kind = inferKind(raw, Array.isArray(rawOptions) ? rawOptions : []);
  if (!kind) return 'kind';
  const prompt = sanitizeQuizText(
    pick(raw, 'prompt', 'q', 'question'),
    QUIZ_PROMPT_MAX + 1,
    counters,
  );
  if (prompt.length < QUIZ_PROMPT_MIN || prompt.length > QUIZ_PROMPT_MAX)
    return 'prompt';
  const rawTopic = pick(raw, 'topic', 't');
  const topicKey =
    typeof rawTopic === 'string' || typeof rawTopic === 'number'
      ? String(rawTopic)
      : '';
  const rawId = pick(raw, 'id');
  const cleanId =
    typeof rawId === 'string' || typeof rawId === 'number'
      ? String(rawId)
          .replace(/[^\w-]/g, '')
          .slice(0, QUESTION_ID_MAX)
      : '';
  // Os ids servem de chave nas estatisticas: nunca uma chave proibida.
  const id = isReservedId(cleanId) ? '' : cleanId;
  const question: QuizQuestion = {
    id: id || `q${index + 1}`,
    topic:
      topics.get(topicKey) ??
      sanitizeQuizText(topicKey, QUIZ_TOPIC_MAX, counters, false),
    kind,
    prompt,
    code: sanitizeQuizText(pick(raw, 'code'), QUIZ_CODE_MAX, counters) || null,
    figure: readFigureRef(raw, index, figures, counters),
    options: textList(rawOptions, QUIZ_OPTION_MAX, counters),
    answer: intList(pick(raw, 'answer', 'a', 'correct')),
    accepted: textList(
      pick(raw, 'accepted', 'acc'),
      QUIZ_OPTION_MAX,
      counters,
    ).slice(0, QUIZ_MAX_ACCEPTED),
    items: textList(pick(raw, 'items'), QUIZ_OPTION_MAX, counters),
    ...(kind === 'match'
      ? readMatch(raw, counters)
      : { left: [], right: [], pairs: [] }),
    explanation: sanitizeQuizText(
      pick(raw, 'explanation', 'e'),
      QUIZ_EXPLANATION_MAX,
      counters,
    ),
    sources: readSources(pick(raw, 'sources', 'src'), counters),
  };
  return checkKind(question) ?? question;
}

const check = (
  id: QuizCheckId,
  status: QuizCheckStatus,
  count = 0,
): QuizCheck => ({ id, status, count });

function fail(checks: QuizCheck[], id: QuizCheckId): QuizImportReport {
  return {
    ok: false,
    quiz: null,
    checks: [...checks, check(id, 'fail')],
    skipped: [],
  };
}

// Ponto de entrada: texto (do ficheiro ou colado) -> relatorio + quiz limpo.
export function checkQuizText(text: string): QuizImportReport {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > QUIZ_MAX_FILE_BYTES) return fail([], 'size');
  const checks: QuizCheck[] = [check('size', 'pass')];

  const data = parseQuizJson(text);
  if (!isObject(data)) return fail(checks, 'json');
  checks.push(check('json', 'pass'));

  if (!depthOk(data) || hasForbiddenKey(data)) return fail(checks, 'structure');
  checks.push(check('structure', 'pass'));

  const rawQuestions = pick(data, 'questions', 'qs');
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0)
    return fail(checks, 'format');
  checks.push(
    check('format', data.format === QUIZ_FORMAT_ID ? 'pass' : 'warn'),
  );

  const counters: Counters = { dangerous: 0, badLinks: 0, badFigures: 0 };
  const topics = readTopics(pick(data, 'topics'), counters);
  const figures = readFigures(pick(data, 'figures'), counters);
  const skipped: QuizSkip[] = [];
  const questions: QuizQuestion[] = [];
  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  rawQuestions.forEach((raw, index) => {
    if (index >= QUIZ_MAX_QUESTIONS) {
      skipped.push({ index, reason: 'tooMany' });
      return;
    }
    const result = readQuestion(raw, index, topics, figures, counters);
    if (typeof result === 'string') {
      skipped.push({ index, reason: result });
      return;
    }
    const stem = foldText(
      `${result.prompt}|${result.code ?? ''}|${result.figure ?? ''}|${result.options.join('|')}`,
    );
    if (seenStems.has(stem)) {
      skipped.push({ index, reason: 'duplicate' });
      return;
    }
    seenStems.add(stem);
    // Id repetido: gera outro, sem nunca repetir um ja usado.
    let id = result.id;
    for (let n = seenIds.size; seenIds.has(id); n += 1)
      id = `q${index + 1}-${n}`;
    seenIds.add(id);
    questions.push({
      ...result,
      id,
      topic: result.topic || [...topics.values()][0] || '',
    });
  });

  checks.push(
    check(
      'content',
      counters.dangerous > 0 ? 'warn' : 'pass',
      counters.dangerous,
    ),
  );
  checks.push(
    check('links', counters.badLinks > 0 ? 'warn' : 'pass', counters.badLinks),
  );
  checks.push(
    check(
      'figures',
      counters.badFigures > 0 ? 'warn' : 'pass',
      counters.badFigures,
    ),
  );
  checks.push(
    check(
      'questions',
      questions.length === 0 ? 'fail' : skipped.length > 0 ? 'warn' : 'pass',
      questions.length,
    ),
  );
  if (questions.length === 0) return { ok: false, quiz: null, checks, skipped };

  const rawSeconds = Number(pick(data, 'secondsPerQuestion'));
  const secondsPerQuestion = Number.isFinite(rawSeconds)
    ? Math.min(
        QUIZ_MAX_SECONDS_PER_QUESTION,
        Math.max(QUIZ_MIN_SECONDS_PER_QUESTION, Math.round(rawSeconds)),
      )
    : QUIZ_DEFAULT_SECONDS_PER_QUESTION;
  const topicLabels = [
    ...new Set(
      [...topics.values(), ...questions.map((q) => q.topic)].filter(Boolean),
    ),
  ];
  const quiz: Quiz = {
    title: sanitizeQuizText(
      pick(data, 'title', 'name'),
      QUIZ_TITLE_MAX,
      counters,
      false,
    ),
    language: sanitizeQuizText(
      pick(data, 'language', 'lang'),
      QUIZ_LANGUAGE_MAX,
      counters,
      false,
    ),
    secondsPerQuestion,
    topics: topicLabels,
    questions,
    figures: Object.fromEntries(
      [...figures].filter(([id]) => questions.some((q) => q.figure === id)),
    ),
  };
  // O servidor volta a medir exatamente este texto (o quiz normalizado pode crescer).
  if (
    new TextEncoder().encode(canonicalQuizText(quiz)).length >
    QUIZ_MAX_FILE_BYTES
  )
    return fail(checks, 'size');
  return { ok: true, quiz, checks, skipped };
}

// Chaves de topo do texto canonico, pela ordem (formato e depois o Quiz).
const CANONICAL_KEYS: readonly string[] = [
  'format',
  'version',
  'title',
  'language',
  'secondsPerQuestion',
  'topics',
  'questions',
  'figures',
] satisfies readonly ('format' | 'version' | keyof Quiz)[];

// Texto que o servidor verifica: o quiz canonico com o identificador do formato.
// Uma chave "format" ou "version" no proprio quiz sobrepoe-se e faz falhar a comparacao.
export function canonicalQuizText(quiz: object): string {
  return JSON.stringify({
    format: QUIZ_FORMAT_ID,
    version: QUIZ_FORMAT_VERSION,
    ...quiz,
  });
}

// Regra estrita do servidor: so aceita um quiz que ja e exatamente a saida
// canonica de checkQuizText (todos os checks em 'pass', nada saltado, mesmas
// chaves pela mesma ordem). `payload` e o texto de canonicalQuizText lido com
// JSON.parse (com "format" e "version"). Devolve o quiz verificado agora, nunca
// o recebido. Quem recebe o texto compara ainda canonicalQuizText(quiz) com os
// bytes recebidos (chaves repetidas, numeros e escapes \u escritos de outra forma).
export function recheckCanonicalQuiz(payload: unknown): Quiz | null {
  // Recusas baratas primeiro: chaves de topo diferentes (ex.: um objeto com
  // 110k chaves) saem logo; depthOk antes do stringify (um JSON muito aninhado
  // rebentava a pilha).
  if (!isObject(payload)) return null;
  const keys = Object.keys(payload);
  if (
    keys.length !== CANONICAL_KEYS.length ||
    keys.some((k, i) => k !== CANONICAL_KEYS[i])
  )
    return null;
  if (!depthOk(payload)) return null;
  const text = JSON.stringify(payload);
  const report = checkQuizText(text);
  const clean =
    report.ok &&
    report.skipped.length === 0 &&
    report.checks.every((c) => c.status === 'pass');
  if (!clean || !report.quiz || canonicalQuizText(report.quiz) !== text)
    return null;
  return report.quiz;
}
