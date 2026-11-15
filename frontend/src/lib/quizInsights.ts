// Estatisticas de um quiz: resultado de uma tentativa (tempo, por tipo, a mais
// demorada), visao geral do quiz, areas a melhorar e perguntas mais lentas.
// Tudo puro: so le o quiz, as estatisticas do servidor e as tentativas.
import type { Quiz, QuizKind, QuizQuestion } from './quizFormat';
import { isAnswered, MS_PER_SECOND, statOf, timesWrong, type QuizStats, type SessionScore } from './quizSession';
import { formatElapsed } from './formatDuration';
import { generatorStatKey, type GeneratorKind } from './quizGenerators';

// Nota de referencia (como no quiz de exemplo): a partir daqui "passaste".
export const QUIZ_PASS_PERCENT = 75;
// A meio caminho: barras ambar entre isto e a nota de referencia.
export const QUIZ_HALF_PERCENT = 50;
export const PERCENT = 100;
// Media recente: as ultimas N tentativas de exame.
export const RECENT_EXAMS = 5;
// Grafico de evolucao: ultimas N tentativas.
export const EVOLUTION_POINTS = 30;
// Quantas areas e perguntas mostrar nas listas de estatisticas.
export const INSIGHT_TOP = 5;
// Uma area so entra no ranking depois de N respostas (evita 0/1 = 0%).
export const MIN_ANSWERS_FOR_RANK = 2;

export const percentOf = (part: number, total: number): number => (total === 0 ? 0 : Math.round((part / total) * PERCENT));

export type ScoreBand = 'good' | 'mid' | 'bad';
export const scoreBand = (percent: number): ScoreBand => (percent >= QUIZ_PASS_PERCENT ? 'good' : percent >= QUIZ_HALF_PERCENT ? 'mid' : 'bad');

// Cor das barras por faixa (sem verde: a app usa violeta para o que esta bem).
export const BAND_FILL: Record<ScoreBand, string> = {
  good: 'bg-violet-500',
  mid: 'bg-amber-500',
  bad: 'bg-red-500',
};

export const formatMs = (ms: number | null): string => (ms === null ? '-' : formatElapsed(Math.round(ms / MS_PER_SECOND)));

// --- Uma tentativa -----------------------------------------------------------

export type ReviewVerdict = 'right' | 'wrong' | 'blank';

export const reviewVerdict = (question: QuizQuestion, response: SessionScore['results'][number]['item']['response'], right: boolean): ReviewVerdict =>
  right ? 'right' : isAnswered(question, response) ? 'wrong' : 'blank';

export interface AttemptTiming {
  totalMs: number;
  avgMs: number;
  // Posicao (0-based) e tempo da pergunta mais demorada; null sem tempos.
  slowest: { index: number; ms: number } | null;
}

export function attemptTiming(score: SessionScore, activeMs: number): AttemptTiming {
  const times = score.results.map((r) => r.item.timeMs);
  const max = times.length ? Math.max(...times) : 0;
  return {
    totalMs: activeMs,
    avgMs: score.total === 0 ? 0 : Math.round(activeMs / score.total),
    slowest: max > 0 ? { index: times.indexOf(max), ms: max } : null,
  };
}

export interface GroupScore<K extends string = string> {
  key: K;
  correct: number;
  total: number;
}

function groupScore<K extends string>(score: SessionScore, keyOf: (q: QuizQuestion) => K): GroupScore<K>[] {
  const map = new Map<K, GroupScore<K>>();
  score.results.forEach(({ question, right }) => {
    const key = keyOf(question);
    const entry = map.get(key) ?? { key, correct: 0, total: 0 };
    entry.total += 1;
    entry.correct += right ? 1 : 0;
    map.set(key, entry);
  });
  return [...map.values()];
}

// Por topico, o pior primeiro.
export const scoreByTopicWorstFirst = (score: SessionScore): GroupScore[] =>
  groupScore(score, (q) => q.topic).sort((a, b) => a.correct / a.total - b.correct / b.total);

export const scoreByKind = (score: SessionScore): GroupScore<QuizKind>[] => groupScore(score, (q) => q.kind);

// --- Visao geral do quiz ------------------------------------------------------

export interface AttemptLike {
  mode: string;
  total: number;
  correct: number;
  durationMs: number;
  finishedAt: string;
}

const EXAM_MODE = 'EXAM';

export interface QuizOverview {
  seen: number;
  attempts: number;
  bestExam: number | null;
  recentExamAvg: number | null;
  wrongNow: number;
  answers: number;
  accuracy: number | null;
  avgMsPerQuestion: number | null;
}

// generators: tipos ligados; as respostas geradas contam no acerto e no tempo.
export function quizOverview(
  quiz: Quiz,
  stats: QuizStats,
  attempts: readonly AttemptLike[],
  wrongNow: number,
  generators: readonly GeneratorKind[] = [],
): QuizOverview {
  let seen = 0;
  let answers = 0;
  let correct = 0;
  let timeMs = 0;
  let timed = 0;
  quiz.questions.forEach((q) => {
    const s = statOf(stats, q.id);
    if (!s || s.seen === 0) return;
    seen += 1;
    answers += s.seen;
    correct += s.correct;
    timeMs += s.timeMs ?? 0;
    timed += s.timed ?? 0;
  });
  generators.forEach((kind) => {
    const s = statOf(stats, generatorStatKey(kind));
    if (!s) return;
    answers += s.seen;
    correct += s.correct;
    timeMs += s.timeMs ?? 0;
    timed += s.timed ?? 0;
  });
  // As tentativas chegam da mais recente para a mais antiga.
  const exams = attempts.filter((a) => a.mode === EXAM_MODE && a.total > 0).map((a) => percentOf(a.correct, a.total));
  const recent = exams.slice(0, RECENT_EXAMS);
  return {
    seen,
    attempts: attempts.length,
    bestExam: exams.length ? Math.max(...exams) : null,
    recentExamAvg: recent.length ? Math.round(recent.reduce((sum, p) => sum + p, 0) / recent.length) : null,
    wrongNow,
    answers,
    accuracy: answers ? percentOf(correct, answers) : null,
    avgMsPerQuestion: timed ? Math.round(timeMs / timed) : null,
  };
}

// --- Areas a melhorar --------------------------------------------------------

export interface TopicInsight {
  topic: string;
  // Area de um gerador de calculo (pratica-se gerando perguntas desse tipo).
  generator?: GeneratorKind;
  total: number;
  seen: number;
  answers: number;
  correct: number;
  accuracy: number | null;
  wrongNow: number;
  avgMs: number | null;
  // Maior = mais precisa de trabalho.
  need: number;
}

// Peso das respostas falhadas da ultima vez e das perguntas por ver.
const NEED_WRONG_NOW = 0.5;
const NEED_UNSEEN = 0.25;

export function topicInsights(quiz: Quiz, stats: QuizStats): TopicInsight[] {
  const map = new Map<string, TopicInsight>();
  const timing = new Map<string, { ms: number; n: number }>();
  quiz.questions.forEach((q) => {
    const entry = map.get(q.topic) ?? { topic: q.topic, total: 0, seen: 0, answers: 0, correct: 0, accuracy: null, wrongNow: 0, avgMs: null, need: 0 };
    const time = timing.get(q.topic) ?? { ms: 0, n: 0 };
    entry.total += 1;
    const s = statOf(stats, q.id);
    if (s && s.seen > 0) {
      entry.seen += 1;
      entry.answers += s.seen;
      entry.correct += s.correct;
      if (!s.last) entry.wrongNow += 1;
      time.ms += s.timeMs ?? 0;
      time.n += s.timed ?? 0;
    }
    map.set(q.topic, entry);
    timing.set(q.topic, time);
  });
  return [...map.values()].map((e) => {
    const time = timing.get(e.topic) ?? { ms: 0, n: 0 };
    const errorRate = e.answers ? 1 - e.correct / e.answers : 0;
    const need = errorRate + (NEED_WRONG_NOW * e.wrongNow) / e.total + (NEED_UNSEEN * (e.total - e.seen)) / e.total;
    return { ...e, accuracy: e.answers ? percentOf(e.correct, e.answers) : null, avgMs: time.n ? Math.round(time.ms / time.n) : null, need };
  });
}

// Geradores ligados como areas: as respostas de cada tipo somam numa chave
// (gen-<tipo>), por isso cada gerador conta como um topico de uma pergunta.
export function generatorInsights(stats: QuizStats, kinds: readonly GeneratorKind[], nameOf: (kind: GeneratorKind) => string): TopicInsight[] {
  return kinds.map((kind) => {
    const s = statOf(stats, generatorStatKey(kind));
    const answers = s?.seen ?? 0;
    const correct = s?.correct ?? 0;
    const wrongNow = s && s.seen > 0 && !s.last ? 1 : 0;
    const unseen = answers === 0 ? 1 : 0;
    const errorRate = answers ? 1 - correct / answers : 0;
    return {
      topic: nameOf(kind),
      generator: kind,
      total: 1,
      seen: 1 - unseen,
      answers,
      correct,
      accuracy: answers ? percentOf(correct, answers) : null,
      wrongNow,
      avgMs: s?.timed ? Math.round((s.timeMs ?? 0) / s.timed) : null,
      need: errorRate + NEED_WRONG_NOW * wrongNow + NEED_UNSEEN * unseen,
    };
  });
}

// So areas com respostas suficientes, a que mais precisa primeiro.
export const weakestTopics = (insights: readonly TopicInsight[], top: number = INSIGHT_TOP): TopicInsight[] =>
  insights
    .filter((t) => t.answers >= MIN_ANSWERS_FOR_RANK)
    .sort((a, b) => b.need - a.need)
    .slice(0, top);

export interface QuestionInsight {
  question: QuizQuestion;
  avgMs: number;
  wrong: number;
  seen: number;
}

function questionInsights(quiz: Quiz, stats: QuizStats): QuestionInsight[] {
  return quiz.questions.flatMap((question) => {
    const s = statOf(stats, question.id);
    if (!s || s.seen === 0) return [];
    return [{ question, avgMs: s.timed ? Math.round((s.timeMs ?? 0) / s.timed) : 0, wrong: timesWrong(s), seen: s.seen }];
  });
}

export const slowestQuestions = (quiz: Quiz, stats: QuizStats, top: number = INSIGHT_TOP): QuestionInsight[] =>
  questionInsights(quiz, stats)
    .filter((q) => q.avgMs > 0)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, top);

export const mostMissedQuestions = (quiz: Quiz, stats: QuizStats, top: number = INSIGHT_TOP): QuestionInsight[] =>
  questionInsights(quiz, stats)
    .filter((q) => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.avgMs - a.avgMs)
    .slice(0, top);

// --- Evolucao ----------------------------------------------------------------

export interface EvolutionPoint {
  at: number;
  percent: number;
  exam: boolean;
}

// Mais antiga a esquerda.
export const evolution = (attempts: readonly AttemptLike[], points: number = EVOLUTION_POINTS): EvolutionPoint[] =>
  attempts
    .filter((a) => a.total > 0)
    .slice(0, points)
    .reverse()
    .map((a) => ({ at: Date.parse(a.finishedAt), percent: percentOf(a.correct, a.total), exam: a.mode === EXAM_MODE }));
