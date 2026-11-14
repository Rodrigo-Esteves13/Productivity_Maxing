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
