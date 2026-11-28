/**
 * Separadores ja abertos (F-15): ficam montados, escondidos, para voltar a
 * eles sem esqueleto. Devolve a mesma lista quando nada muda.
 */
export function addVisitedTab<T>(visited: readonly T[], tab: T): readonly T[] {
  return visited.includes(tab) ? visited : [...visited, tab];
}
