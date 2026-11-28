import { describe, expect, it } from 'vitest';
import { sortQuizzes } from './quizList';

const quiz = (title: string, createdAt: string, lastScorePct: number | null) => ({ title, createdAt, lastScorePct });

describe('sortQuizzes', () => {
  const list = [
    quiz('Beta', '2026-01-02T00:00:00.000Z', 40),
    quiz('Alpha', '2026-01-03T00:00:00.000Z', null),
    quiz('Gamma', '2026-01-01T00:00:00.000Z', 90),
  ];

  it('puts the newest first', () => {
    expect(sortQuizzes(list, 'recent').map((q) => q.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('puts the best score first and quizzes never taken last', () => {
    expect(sortQuizzes(list, 'score').map((q) => q.title)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('breaks score ties by date', () => {
    const tied = [quiz('Old', '2026-01-01T00:00:00.000Z', 50), quiz('New', '2026-01-05T00:00:00.000Z', 50)];
    expect(sortQuizzes(tied, 'score').map((q) => q.title)).toEqual(['New', 'Old']);
  });

  it('orders by title', () => {
    expect(sortQuizzes(list, 'title').map((q) => q.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('does not change the original list', () => {
    const copy = [...list];
    sortQuizzes(list, 'score');
    expect(list).toEqual(copy);
  });
});
