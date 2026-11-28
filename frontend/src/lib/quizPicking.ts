// Escolha das perguntas: exame, pratica, erradas e conjuntos.

import type { Quiz, QuizKind, QuizQuestion } from './quizFormat';
import { type QuestionStat, type QuizStats, statOf } from './quizSessionTypes';
import { type Rand, shuffle } from './quizGrading';

// Pesos da escolha do exame (como no quiz de exemplo).
export const EXAM_WEIGHT = {
  unseen: 1.2,
  lastWrong: 2.5,
  perWrong: 0.6,
  perRight: 0.15,
  inWrongList: 1.5,
  lastExam: -2,
} as const;

export interface ExamPickOptions {
  // Da prioridade ao que falhaste e ao que ainda nao viste.
  weak?: boolean;
  stats?: QuizStats;
  // Perguntas do exame anterior: ficam para o fim da fila.
  avoid?: readonly string[];
}

// Exame equilibrado por topico: vai buscar uma pergunta a cada topico a vez,
// cada topico ordenado pelo peso (aleatorio, pontos fracos, exame anterior).
export function pickExam(quiz: Quiz, size: number, rand: Rand = Math.random, options: ExamPickOptions = {}): QuizQuestion[] {
  const stats = options.stats ?? {};
  const avoid = new Set(options.avoid ?? []);
  const weight = (q: QuizQuestion) => {
    let w = rand();
    const s = statOf(stats, q.id);
    if (options.weak) {
      if (!s) w += EXAM_WEIGHT.unseen;
      else {
        if (!s.last) w += EXAM_WEIGHT.lastWrong;
        w += Math.max(0, s.seen - s.correct) * EXAM_WEIGHT.perWrong - s.correct * EXAM_WEIGHT.perRight;
        if (!s.last && !s.dismissed) w += EXAM_WEIGHT.inWrongList;
      }
    }
    if (avoid.has(q.id)) w += EXAM_WEIGHT.lastExam;
    return w;
  };
  const byTopic = new Map<string, { w: number; q: QuizQuestion }[]>();
  quiz.questions.forEach((q) => {
    const list = byTopic.get(q.topic) ?? [];
    list.push({ w: weight(q), q });
    byTopic.set(q.topic, list);
  });
  const queues = shuffle([...byTopic.values()], rand).map((list) => list.sort((a, b) => b.w - a.w).map((x) => x.q));
  const out: QuizQuestion[] = [];
  const limit = Math.min(size, quiz.questions.length);
  for (let round = 0; out.length < limit; round += 1) {
    queues.forEach((queue) => {
      if (out.length < limit && round < queue.length) out.push(queue[round]);
    });
  }
  return shuffle(out, rand);
}

export function pickPractice(quiz: Quiz, topics: string[], kinds: QuizKind[], size: number, rand: Rand = Math.random): QuizQuestion[] {
  const pool = quiz.questions.filter(
    (q) => (topics.length === 0 || topics.includes(q.topic)) && (kinds.length === 0 || kinds.includes(q.kind)),
  );
  return shuffle(pool, rand).slice(0, size);
}

export const timesWrong = (s: QuestionStat | undefined): number => (s ? Math.max(0, s.seen - s.correct) : 0);

// Area de erradas: falhada da ultima vez e nao tirada da lista. As que falhaste
// mais vezes primeiro, depois as mais recentes.
export function wrongQuestions(quiz: Quiz, stats: QuizStats): QuizQuestion[] {
  const inList = quiz.questions.filter((q) => {
    const s = statOf(stats, q.id);
    return s?.last === false && !s.dismissed;
  });
  return inList.sort((a, b) => {
    const sa = statOf(stats, a.id);
    const sb = statOf(stats, b.id);
    return timesWrong(sb) - timesWrong(sa) || (sb?.wrongAt ?? 0) - (sa?.wrongAt ?? 0);
  });
}

// Conjunto de perguntas de onde o exame e a pratica escolhem.
export type QuestionPool = 'all' | 'unseen' | 'wrong' | 'unseenWrong';
export const QUESTION_POOLS: QuestionPool[] = ['all', 'unseen', 'wrong', 'unseenWrong'];

const isUnseen = (stats: QuizStats, id: string) => (statOf(stats, id)?.seen ?? 0) === 0;

// Nunca vistas, so as erradas (area de erradas) ou as duas juntas.
export function poolQuestions(quiz: Quiz, stats: QuizStats, pool: QuestionPool): QuizQuestion[] {
  if (pool === 'all') return quiz.questions;
  const wrong = new Set(wrongQuestions(quiz, stats).map((q) => q.id));
  return quiz.questions.filter((q) => {
    const unseen = isUnseen(stats, q.id);
    if (pool === 'unseen') return unseen;
    if (pool === 'wrong') return wrong.has(q.id);
    return unseen || wrong.has(q.id);
  });
}
