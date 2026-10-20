// Pesquisa local sem diferenca entre maiusculas e acentos ("revisao"
// encontra "Revisão"). Usada na paleta Ctrl+K para as tasks, que ja estao
// em memoria com notas e subtasks.

const MARKS = /\p{M}/gu;

export function foldText(text: string): string {
  return text.normalize('NFD').replace(MARKS, '').toLowerCase();
}

export interface TextSnippet {
  before: string;
  match: string;
  after: string;
}

// Posicao no texto original de cada caractere do texto dobrado. "Revisão"
// escrito com o acento a parte (texto colado do macOS: "a" + "~") perde
// um caractere ao dobrar, por isso as posicoes nao batem certo sem isto.
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let index = 0;
  for (const char of text) {
    const piece = foldText(char);
    for (let k = 0; k < piece.length; k++) {
      folded += piece[k];
      map.push(index);
    }
    index += char.length;
  }
  map.push(index);
  return { folded, map };
}

/**
 * O excerto do texto a volta da primeira ocorrencia de `foldedQuery` (ja
 * passada por foldText), com `context` caracteres antes. null se nao houver.
 * Quebras de linha viram espacos, para caber numa linha.
 */
export function snippetAround(text: string, foldedQuery: string, context = 30): TextSnippet | null {
  if (!foldedQuery) return null;
  const { folded, map } = foldWithMap(text);
  const at = folded.indexOf(foldedQuery);
  if (at === -1) return null;
  const start = map[at];
  const end = map[at + foldedQuery.length];
  const from = Math.max(0, start - context);
  const flat = (part: string) => part.replace(/\s+/g, ' ');
  return {
    before: (from > 0 ? '...' : '') + flat(text.slice(from, start)).trimStart(),
    match: flat(text.slice(start, end)),
    // O resto e cortado pelo CSS; 120 chega para encher a linha.
    after: flat(text.slice(end, end + 120)),
  };
}
