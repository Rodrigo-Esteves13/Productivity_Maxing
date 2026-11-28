import { foldText } from './textSearch';

// Filtro de lista por texto livre, sem diferenca entre maiusculas e acentos.
// Varias palavras na pesquisa tem de aparecer todas (em qualquer campo).

export function splitQuery(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean);
}

/** true se todas as palavras da pesquisa aparecem em algum dos campos. */
export function matchesQuery(query: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  const words = splitQuery(query);
  if (words.length === 0) return true;
  const haystack = fields.map((field) => (field ? foldText(field) : '')).join(' ');
  return words.every((word) => haystack.includes(word));
}

/** Filtra `items` pelo texto devolvido por `getFields`. Pesquisa vazia devolve a lista original. */
export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => ReadonlyArray<string | null | undefined>,
): T[] {
  if (splitQuery(query).length === 0) return items.slice();
  return items.filter((item) => matchesQuery(query, getFields(item)));
}
