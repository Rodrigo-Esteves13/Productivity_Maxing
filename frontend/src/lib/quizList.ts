import type { QuizSummary } from '../api/quizzesService';

// Ordenacao da lista de quizzes. Puro e sem rede.

export const QUIZ_SORTS = ['recent', 'score', 'title'] as const;
export type QuizSort = (typeof QUIZ_SORTS)[number];

export const DEFAULT_QUIZ_SORT: QuizSort = 'recent';

type SortableQuiz = Pick<QuizSummary, 'title' | 'createdAt' | 'lastScorePct'>;

// Sem nota (nunca feito) vai sempre para o fim; empates ficam por data.
const byRecent = (a: SortableQuiz, b: SortableQuiz) => b.createdAt.localeCompare(a.createdAt);

const COMPARATORS: Record<QuizSort, (a: SortableQuiz, b: SortableQuiz) => number> = {
  recent: byRecent,
  score: (a, b) => {
    if (a.lastScorePct === null && b.lastScorePct === null) return byRecent(a, b);
    if (a.lastScorePct === null) return 1;
    if (b.lastScorePct === null) return -1;
    return b.lastScorePct - a.lastScorePct || byRecent(a, b);
  },
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }),
};

/** Copia ordenada; nunca altera a lista original. */
export function sortQuizzes<T extends SortableQuiz>(quizzes: readonly T[], sort: QuizSort): T[] {
  return [...quizzes].sort(COMPARATORS[sort]);
}
