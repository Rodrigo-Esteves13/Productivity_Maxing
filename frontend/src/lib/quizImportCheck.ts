// Ponto de entrada da verificacao e forma canonica do quiz.

import {
  QUIZ_DEFAULT_SECONDS_PER_QUESTION,
  QUIZ_FORMAT_ID,
  QUIZ_FORMAT_VERSION,
  QUIZ_LANGUAGE_MAX,
  QUIZ_MAX_FILE_BYTES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MAX_SECONDS_PER_QUESTION,
  QUIZ_MIN_SECONDS_PER_QUESTION,
  QUIZ_TITLE_MAX,
  type Quiz,
  type QuizQuestion,
} from './quizFormat';
import { foldText } from './textSearch';
import type { QuizCheckId, QuizCheckStatus, QuizCheck, QuizSkip, QuizImportReport } from './quizImportTypes';
import { type Counters, isObject, pick, sanitizeQuizText } from './quizImportShared';
import { depthOk, hasForbiddenKey, parseQuizJson } from './quizImportJson';
import { readTopics, readFigures } from './quizImportMeta';
import { readQuestion } from './quizImportQuestion';

const check = (id: QuizCheckId, status: QuizCheckStatus, count = 0): QuizCheck => ({ id, status, count });

function fail(checks: QuizCheck[], id: QuizCheckId): QuizImportReport {
  return { ok: false, quiz: null, checks: [...checks, check(id, 'fail')], skipped: [] };
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
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return fail(checks, 'format');
  checks.push(check('format', data.format === QUIZ_FORMAT_ID ? 'pass' : 'warn'));

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
    const stem = foldText(`${result.prompt}|${result.code ?? ''}|${result.figure ?? ''}|${result.options.join('|')}`);
    if (seenStems.has(stem)) {
      skipped.push({ index, reason: 'duplicate' });
      return;
    }
    seenStems.add(stem);
    // Id repetido: gera outro, sem nunca repetir um ja usado.
    let id = result.id;
    for (let n = seenIds.size; seenIds.has(id); n += 1) id = `q${index + 1}-${n}`;
    seenIds.add(id);
    questions.push({ ...result, id, topic: result.topic || [...topics.values()][0] || '' });
  });

  checks.push(check('content', counters.dangerous > 0 ? 'warn' : 'pass', counters.dangerous));
  checks.push(check('links', counters.badLinks > 0 ? 'warn' : 'pass', counters.badLinks));
  checks.push(check('figures', counters.badFigures > 0 ? 'warn' : 'pass', counters.badFigures));
  checks.push(check('questions', questions.length === 0 ? 'fail' : skipped.length > 0 ? 'warn' : 'pass', questions.length));
  if (questions.length === 0) return { ok: false, quiz: null, checks, skipped };

  const rawSeconds = Number(pick(data, 'secondsPerQuestion'));
  const secondsPerQuestion = Number.isFinite(rawSeconds)
    ? Math.min(QUIZ_MAX_SECONDS_PER_QUESTION, Math.max(QUIZ_MIN_SECONDS_PER_QUESTION, Math.round(rawSeconds)))
    : QUIZ_DEFAULT_SECONDS_PER_QUESTION;
  const topicLabels = [...new Set([...topics.values(), ...questions.map((q) => q.topic)].filter(Boolean))];
  const quiz: Quiz = {
    title: sanitizeQuizText(pick(data, 'title', 'name'), QUIZ_TITLE_MAX, counters, false),
    language: sanitizeQuizText(pick(data, 'language', 'lang'), QUIZ_LANGUAGE_MAX, counters, false),
    secondsPerQuestion,
    topics: topicLabels,
    questions,
    figures: Object.fromEntries([...figures].filter(([id]) => questions.some((q) => q.figure === id))),
  };
  // O servidor volta a medir exatamente este texto (o quiz normalizado pode crescer).
  if (new TextEncoder().encode(canonicalQuizText(quiz)).length > QUIZ_MAX_FILE_BYTES) return fail(checks, 'size');
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
  return JSON.stringify({ format: QUIZ_FORMAT_ID, version: QUIZ_FORMAT_VERSION, ...quiz });
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
  if (keys.length !== CANONICAL_KEYS.length || keys.some((k, i) => k !== CANONICAL_KEYS[i])) return null;
  if (!depthOk(payload)) return null;
  const text = JSON.stringify(payload);
  const report = checkQuizText(text);
  const clean = report.ok && report.skipped.length === 0 && report.checks.every((c) => c.status === 'pass');
  if (!clean || !report.quiz || canonicalQuizText(report.quiz) !== text) return null;
  return report.quiz;
}
