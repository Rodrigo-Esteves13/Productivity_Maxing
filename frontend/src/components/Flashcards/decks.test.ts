import { describe, expect, it } from 'vitest';
import { groupDecks, isDue } from './decks';
import type { Flashcard } from '../../types/models';

const NOW = Date.parse('2026-01-02T00:00:00.000Z');
const card = (id: string, areaId: string | null, dueAt: string): Flashcard => ({
  id,
  areaId,
  front: id,
  back: id,
  dueAt,
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  createdAt: dueAt,
});

describe('groupDecks', () => {
  const cards = [
    card('a', null, '2026-01-01T00:00:00.000Z'),
    card('b', 'x', '2026-01-05T00:00:00.000Z'),
    card('c', 'y', '2026-01-01T00:00:00.000Z'),
    card('d', 'y', '2026-01-01T12:00:00.000Z'),
  ];

  it('groups by area, most due first, no-area last', () => {
    const decks = groupDecks(cards, NOW);
    expect(decks.map((d) => d.areaId)).toEqual(['y', 'x', null]);
    expect(decks[0].due).toBe(2);
    expect(decks[1].due).toBe(0);
  });

  it('orders cards inside a deck by due date', () => {
    expect(groupDecks(cards, NOW)[0].cards.map((c) => c.id)).toEqual(['c', 'd']);
  });

  it('isDue compares against now', () => {
    expect(isDue(cards[0], NOW)).toBe(true);
    expect(isDue(cards[1], NOW)).toBe(false);
  });
});
