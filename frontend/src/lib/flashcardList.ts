import type { Flashcard } from '../types/models';

// Ordenacao e exportacao da lista de cartoes. Puro e sem rede.

export const CARD_SORTS = ['due', 'newest', 'front', 'lapses'] as const;
export type CardSort = (typeof CARD_SORTS)[number];

export const DEFAULT_CARD_SORT: CardSort = 'due';

const COMPARATORS: Record<CardSort, (a: Flashcard, b: Flashcard) => number> = {
  due: (a, b) => a.dueAt.localeCompare(b.dueAt),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  front: (a, b) => a.front.localeCompare(b.front, undefined, { sensitivity: 'base', numeric: true }),
  lapses: (a, b) => b.lapses - a.lapses || a.dueAt.localeCompare(b.dueAt),
};

/** Comparador de cartoes para a ordenacao pedida. */
export function cardComparator(sort: CardSort): (a: Flashcard, b: Flashcard) => number {
  return COMPARATORS[sort];
}

/** Copia ordenada; nunca altera a lista original. */
export function sortCards(cards: readonly Flashcard[], sort: CardSort): Flashcard[] {
  return [...cards].sort(COMPARATORS[sort]);
}

// Uma linha por cartao, frente e verso separados por TAB: tem de ficar numa
// so linha e sem TAB dentro dos campos para o import ler de volta.
const flattenField = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ').replace(/\t/g, ' ').trim();

/** Inverso do import (lib/flashcardImport): "frente<TAB>verso" por linha. */
export function cardsToTsv(cards: readonly Pick<Flashcard, 'front' | 'back'>[]): string {
  return cards.map((card) => `${flattenField(card.front)}\t${flattenField(card.back)}`).join('\n');
}
