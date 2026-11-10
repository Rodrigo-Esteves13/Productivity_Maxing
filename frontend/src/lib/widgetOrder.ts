// Ordem dos cartoes do Dashboard: funcoes puras (sem React, sem storage).

/** Normaliza uma ordem guardada contra a ordem por omissao:
 *  descarta ids desconhecidos e duplicados e mete os ids novos (que a lista
 *  guardada nao conhece) logo a seguir ao id que os precede por omissao. */
export function normalizeOrder<T extends string>(stored: unknown, defaults: readonly T[]): T[] {
  const known = new Set<string>(defaults);
  const result: T[] = [];
  const seen = new Set<string>();
  if (Array.isArray(stored)) {
    for (const id of stored) {
      if (typeof id === 'string' && known.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id as T);
      }
    }
  }
  defaults.forEach((id, defaultIndex) => {
    if (seen.has(id)) return;
    let insertAt = 0;
    for (let i = defaultIndex - 1; i >= 0; i -= 1) {
      const at = result.indexOf(defaults[i]);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
    seen.add(id);
  });
  return result;
}

/** Troca o id com o vizinho na direcao dada (-1 sobe, 1 desce). Nos extremos
 *  ou com id desconhecido devolve a mesma ordem (copia). */
export function moveItem<T>(order: readonly T[], id: T, direction: -1 | 1): T[] {
  const from = order.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Ordem por omissao (copia, para nunca expor o array constante). */
export function resetOrder<T>(defaults: readonly T[]): T[] {
  return [...defaults];
}

export function isDefaultOrder<T>(order: readonly T[], defaults: readonly T[]): boolean {
  return order.length === defaults.length && order.every((id, i) => id === defaults[i]);
}
