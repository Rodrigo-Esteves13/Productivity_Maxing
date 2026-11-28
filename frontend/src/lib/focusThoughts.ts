// Pensamentos guardados durante o foco ("Got distracted"): uma unica nota
// pessoal, uma linha por pensamento, a mais recente no fim.
// Igual a PERSONAL_NOTE_BODY_MAX_LENGTH no backend (personal-notes.constants.ts).
export const NOTE_BODY_MAX_LENGTH = 10_000;
export const THOUGHT_MAX_LENGTH = 200;

const LINE_PREFIX = '- ';

// Titulo da nota em cada lingua (focus.distractions.noteTitle). Serve para
// reencontrar a nota depois de mudares de lingua, em vez de criar outra.
export const FOCUS_NOTE_TITLES: readonly string[] = [
  'During focus',
  'Durante o foco',
  'Durante el enfoque',
  'Pendant la concentration',
  'Während des Fokus',
  '集中中のメモ',
  '집중하는 동안',
  '专注期间',
];

export interface AppendedThought {
  body: string;
  // Linhas antigas descartadas para a nota caber no limite.
  dropped: number;
}

// Acrescenta uma linha "- <quando> <pensamento>". Se a nota passar o limite,
// descarta as linhas mais antigas (nunca corta uma a meio).
export function appendThought(body: string, thought: string, stamp: string): AppendedThought {
  // Array.from conta carateres (nao unidades UTF-16): nunca parte um par de substituicao.
  const clean = Array.from(thought.trim().replace(/\s+/g, ' ')).slice(0, THOUGHT_MAX_LENGTH).join('');
  const lines = body.split('\n').filter((l) => l.trim() !== '');
  if (!clean) return { body, dropped: 0 };
  lines.push(`${LINE_PREFIX}${stamp} ${clean}`);
  let dropped = 0;
  while (lines.length > 1 && lines.join('\n').length > NOTE_BODY_MAX_LENGTH) {
    lines.shift();
    dropped += 1;
  }
  return { body: lines.join('\n'), dropped };
}
