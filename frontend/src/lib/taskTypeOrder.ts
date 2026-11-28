// Reordenar tipos de tarefa com subir/descer. O campo `order` pode ter empates
// (todos a 0), por isso a troca e feita sobre a posicao na lista ordenada e so
// devolve os itens cujo `order` muda de facto.

export interface OrderedItem {
  id: string;
  order: number;
}

export type MoveDirection = 'up' | 'down';

export interface OrderUpdate {
  id: string;
  order: number;
}

const MOVE_STEP: Record<MoveDirection, number> = { up: -1, down: 1 };

/** Lista ordenada por `order` (estavel: empates mantem a ordem recebida). */
export function sortByOrder<T extends OrderedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/** true se o item pode andar nessa direcao dentro da lista ordenada. */
export function canMove(items: readonly OrderedItem[], id: string, direction: MoveDirection): boolean {
  const sorted = sortByOrder(items);
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const target = index + MOVE_STEP[direction];
  return target >= 0 && target < sorted.length;
}

/** Novos `order` (= posicao) depois de mover `id` um lugar; so os que mudam. */
export function moveUpdates(items: readonly OrderedItem[], id: string, direction: MoveDirection): OrderUpdate[] {
  if (!canMove(items, id, direction)) return [];
  const sorted = sortByOrder(items);
  const from = sorted.findIndex((item) => item.id === id);
  const to = from + MOVE_STEP[direction];
  const next = [...sorted];
  [next[from], next[to]] = [next[to], next[from]];
  const updates: OrderUpdate[] = [];
  next.forEach((item, position) => {
    if (item.order !== position) updates.push({ id: item.id, order: position });
  });
  return updates;
}
