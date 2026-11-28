import type { Flashcard } from '../types/models';
import { neutralizeFormulaPrefix } from '../utils/taskExportFormats';

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

// Um campo que comece por = + - @ seria uma formula ao abrir o ficheiro numa
// folha de calculo (os cartoes podem vir de quizzes de outra pessoa). Mesmo
// apostrofo do CSV; o import tira-o.
const exportField = (text: string) => neutralizeFormulaPrefix(flattenField(text));

/** Inverso do import (lib/flashcardImport): "frente<TAB>verso" por linha. */
export function cardsToTsv(cards: readonly Pick<Flashcard, 'front' | 'back'>[]): string {
  return cards.map((card) => `${exportField(card.front)}\t${exportField(card.back)}`).join('\n');
}
