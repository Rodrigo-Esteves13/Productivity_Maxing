import { describe, expect, it } from 'vitest';
import { cardsToTsv, sortCards } from './flashcardList';
import { parseFlashcardText } from './flashcardImport';
import type { Flashcard } from '../types/models';

const card = (id: string, over: Partial<Flashcard> = {}): Flashcard => ({
  id,
  areaId: null,
  front: id,
  back: `back ${id}`,
  dueAt: '2026-01-01T00:00:00.000Z',
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('sortCards', () => {
  const list = [
    card('b', { dueAt: '2026-01-03T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', lapses: 1 }),
    card('a', { dueAt: '2026-01-05T00:00:00.000Z', createdAt: '2026-01-03T00:00:00.000Z', lapses: 4 }),
    card('c', { dueAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z', lapses: 0 }),
  ];

  it('orders by due date, soonest first', () => {
    expect(sortCards(list, 'due').map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('orders by creation, newest first', () => {
    expect(sortCards(list, 'newest').map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('orders by front text', () => {
    expect(sortCards(list, 'front').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders by lapses, most failed first', () => {
    expect(sortCards(list, 'lapses').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not change the original list', () => {
    const copy = [...list];
    sortCards(list, 'front');
    expect(list).toEqual(copy);
  });
});

describe('cardsToTsv', () => {
  it('writes front TAB back, one card per line', () => {
    expect(cardsToTsv([card('x', { front: 'hello', back: 'ola' }), card('y', { front: 'bye', back: 'adeus' })])).toBe(
      'hello\tola\nbye\tadeus',
    );
  });

  it('flattens line breaks and tabs so the line stays whole', () => {
    expect(cardsToTsv([card('x', { front: 'a\tb', back: 'one\ntwo\r\nthree' })])).toBe('a b\tone two three');
  });

  it('is readable by the import', () => {
    const cards = [card('x', { front: 'capital', back: 'Lisboa, Portugal' }), card('y', { front: 'dois', back: '2' })];
    const parsed = parseFlashcardText(cardsToTsv(cards));
    expect(parsed.skipped).toEqual([]);
    expect(parsed.cards).toEqual([
      { front: 'capital', back: 'Lisboa, Portugal' },
      { front: 'dois', back: '2' },
    ]);
  });

  it('returns an empty text for no cards', () => {
    expect(cardsToTsv([])).toBe('');
  });
});
