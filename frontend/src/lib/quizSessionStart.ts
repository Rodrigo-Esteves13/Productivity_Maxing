// Montar uma sessao: opcoes baralhadas por tentativa.

import { EMPTY_RESPONSE, TRUE_FALSE_OPTIONS, type QuizQuestion, type QuizResponse } from './quizFormat';
import {
  type QuizMode,
  NO_MATCH,
  MS_PER_SECOND,
  type SessionItem,
  type QuizSession,
} from './quizSessionTypes';
import { type Rand, shuffle, range, sameList } from './quizGrading';

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
