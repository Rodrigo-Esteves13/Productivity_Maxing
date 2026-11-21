// Importacao de cartoes a partir de texto colado (Quizlet, Anki, folhas de
// calculo): um cartao por linha, frente e verso separados por TAB, ponto e
// virgula ou virgula (a primeira que aparecer na linha; o verso pode ter mais
// virgulas). Puro e sem rede.
export const IMPORT_FRONT_MAX = 300;
export const IMPORT_BACK_MAX = 2000;
// Espelha FLASHCARD_BULK_MAX do backend (flashcards.constants.ts).
export const IMPORT_BATCH_MAX = 100;
const SEPARATORS = ['\t', ';', ','] as const;

export type ImportSkipReason = 'noSeparator' | 'empty' | 'tooLong' | 'duplicate';

export interface ImportedCard {
  front: string;
  back: string;
}

export interface ImportSkip {
  line: number;
  reason: ImportSkipReason;
}

export interface ImportParseResult {
  cards: ImportedCard[];
  skipped: ImportSkip[];
}

function splitLine(line: string): [string, string] | null {
  let best = -1;
  for (const separator of SEPARATORS) {
    const at = line.indexOf(separator);
    if (at !== -1 && (best === -1 || at < best)) best = at;
  }
  // Tab ganha sempre que existir (e o formato do Quizlet e do Anki).
  const tab = line.indexOf('\t');
  if (tab !== -1) best = tab;
  if (best === -1) return null;
  return [line.slice(0, best).trim(), line.slice(best + 1).trim()];
}

/** `existingFronts`: frentes que o user ja tem (comparacao sem maiusculas). */
export function parseFlashcardText(text: string, existingFronts: readonly string[] = []): ImportParseResult {
  const seen = new Set(existingFronts.map((front) => front.trim().toLowerCase()));
  const cards: ImportedCard[] = [];
  const skipped: ImportSkip[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const line = index + 1;
    const parts = splitLine(raw);
    if (!parts) return void skipped.push({ line, reason: 'noSeparator' });
    const [front, back] = parts;
    if (!front || !back) return void skipped.push({ line, reason: 'empty' });
    if (front.length > IMPORT_FRONT_MAX || back.length > IMPORT_BACK_MAX) {
      return void skipped.push({ line, reason: 'tooLong' });
    }
    const key = front.toLowerCase();
    if (seen.has(key)) return void skipped.push({ line, reason: 'duplicate' });
    seen.add(key);
    cards.push({ front, back });
  });
  return { cards, skipped };
}

export function chunkCards<T>(cards: readonly T[], size: number = IMPORT_BATCH_MAX): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < cards.length; i += size) chunks.push(cards.slice(i, i + size));
  return chunks;
}

// Espelha MAX_FLASHCARDS_PER_USER do backend.
export const FLASHCARD_USER_MAX = 2000;

export interface ReverseResult {
  // Cartoes finais: originais seguidos dos inversos aceites.
  cards: ImportedCard[];
  reverseCount: number;
  // Inversos nao criados: verso maior que a frente aceita / frente repetida /
  // limite de cartoes por utilizador.
  skippedTooLong: number;
  skippedDuplicate: number;
  skippedOverCap: number;
}

/**
 * Junta o cartao inverso (verso vira frente) a cada cartao. `existingFronts`
 * sao as frentes que o user ja tem; `existingCount` entra no limite global.
 * Um inverso e ignorado se o verso nao cabe numa frente, se a frente ja existe
 * (ou e de outro cartao do lote) ou se passaria o limite de cartoes.
 */
export function withReverseCards(
  cards: readonly ImportedCard[],
  existingFronts: readonly string[] = [],
  existingCount: number = existingFronts.length,
): ReverseResult {
  const seen = new Set(existingFronts.map((front) => front.trim().toLowerCase()));
  for (const card of cards) seen.add(card.front.trim().toLowerCase());
  const result: ReverseResult = {
    cards: [...cards],
    reverseCount: 0,
    skippedTooLong: 0,
    skippedDuplicate: 0,
    skippedOverCap: 0,
  };
  for (const card of cards) {
    if (card.back.length > IMPORT_FRONT_MAX) {
      result.skippedTooLong += 1;
      continue;
    }
    const key = card.back.trim().toLowerCase();
    if (seen.has(key)) {
      result.skippedDuplicate += 1;
      continue;
    }
    if (existingCount + result.cards.length >= FLASHCARD_USER_MAX) {
      result.skippedOverCap += 1;
      continue;
    }
    seen.add(key);
    result.cards.push({ front: card.back, back: card.front });
    result.reverseCount += 1;
  }
  return result;
}
