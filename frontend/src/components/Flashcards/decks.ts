import { cardComparator } from '../../lib/flashcardList';
import type { Flashcard } from '../../types/models';

type CardComparator = (a: Flashcard, b: Flashcard) => number;

export interface Deck {
  areaId: string | null;
  cards: Flashcard[];
  due: number;
}

export const isDue = (card: Flashcard, now: number) => Date.parse(card.dueAt) <= now;

// Um baralho por cadeira (null = sem cadeira, no fim), com os cartoes por vencer primeiro.
export function groupDecks(cards: Flashcard[], now: number, compare: CardComparator = cardComparator('due')): Deck[] {
  const byArea = new Map<string | null, Flashcard[]>();
  for (const card of cards) byArea.set(card.areaId, [...(byArea.get(card.areaId) ?? []), card]);
  return [...byArea.entries()]
    .map(([areaId, list]) => ({
      areaId,
      cards: [...list].sort(compare),
      due: list.filter((c) => isDue(c, now)).length,
    }))
    .sort((a, b) => Number(a.areaId === null) - Number(b.areaId === null) || b.due - a.due);
}
