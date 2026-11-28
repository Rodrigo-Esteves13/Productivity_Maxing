// Pontuacao, estatisticas e dominio por topico.

import type { Quiz, QuizQuestion } from './quizFormat';
import { type SessionItem, type QuizSession, type QuizStats, statOf } from './quizSessionTypes';
import { gradeQuestion } from './quizGrading';

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
