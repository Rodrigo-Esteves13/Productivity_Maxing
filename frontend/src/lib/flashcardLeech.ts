// Cartoes "sanguessuga": falhados vezes demais. Puro, sem rede; o backend ja
// guarda `lapses`.
import type { Flashcard } from '../types/models';

export const LEECH_LAPSES = 8;
// Versos mais longos que isto pedem para ser partidos em varios cartoes.
export const LEECH_LONG_BACK = 200;
// Frentes mais longas que isto costumam ser melhores como lacuna (cloze).
export const LEECH_LONG_FRONT = 80;

export type LeechAdvice = 'rewrite' | 'split' | 'cloze';

export const isLeech = (card: Pick<Flashcard, 'lapses'>): boolean => card.lapses >= LEECH_LAPSES;

export const leechAdviceKey = (card: Pick<Flashcard, 'front' | 'back'>): LeechAdvice => {
  if (card.back.length > LEECH_LONG_BACK || card.back.includes('\n')) return 'split';
  if (card.front.length > LEECH_LONG_FRONT) return 'cloze';
  return 'rewrite';
};
