import { describe, expect, it } from 'vitest';
import type { Flashcard } from '../types/models';
import { buildTest, CHOICE_OPTIONS, isCorrect, scoreTest } from './flashcardTest';

function card(id: string, front: string, back: string, areaId: string | null = 'a'): Flashcard {
  return { id, front, back, areaId, dueAt: '', intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: '' };
}

// Gerador fixo para testes reproduziveis.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const deck = [
  card('1', 'cat', 'gato'),
  card('2', 'dog', 'cão'),
  card('3', 'bird', 'pássaro'),
  card('4', 'fish', 'peixe'),
  card('5', 'cow', 'vaca', 'b'),
];

describe('buildTest', () => {
  it('limits the size and rotates kinds', () => {
    const q = buildTest(deck, 3, ['choice', 'typed', 'trueFalse'], seeded());
    expect(q).toHaveLength(3);
    expect(q.map((x) => x.kind)).toEqual(['choice', 'typed', 'trueFalse']);
  });
  it('builds choice options with the right answer and distinct distractors', () => {
    const [q] = buildTest(deck, 1, ['choice'], seeded(7));
    expect(q.options).toHaveLength(CHOICE_OPTIONS);
    expect(q.options).toContain(q.card.back);
    expect(new Set(q.options).size).toBe(CHOICE_OPTIONS);
  });
  it('falls back to typed when there are no other answers', () => {
    const q = buildTest([card('x', 'a', 'same'), card('y', 'b', 'Same')], 2, ['choice'], seeded());
    expect(q.every((x) => x.kind === 'typed')).toBe(true);
  });
  it('shows a wrong answer for false statements', () => {
    const q = buildTest(deck, 5, ['trueFalse'], seeded(3));
    for (const x of q) expect(x.shown === x.card.back).toBe(x.shownIsCorrect);
  });
});

describe('isCorrect and scoreTest', () => {
  const [typed] = buildTest([deck[1], deck[0]], 1, ['typed'], seeded());
  it('ignores accents, case, spaces and trailing punctuation', () => {
    expect(isCorrect(typed, `  ${typed.card.back.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')}. `)).toBe(true);
    expect(isCorrect(typed, 'nope')).toBe(false);
  });
  it('scores and lists missed questions', () => {
    const qs = buildTest(deck, 2, ['typed'], seeded());
    const score = scoreTest(qs, [qs[0].card.back, 'wrong']);
    expect(score).toMatchObject({ correct: 1, total: 2, percent: 50 });
    expect(score.missed).toEqual([qs[1]]);
  });
});
