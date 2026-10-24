// Ordem manual das Areas (arrastar na pagina Areas). Guardada so como lista
// de ids: Areas que nao estao na lista (novas) ficam no fim, pela ordem em
// que ja vinham, e ids de Areas apagadas sao simplesmente ignorados.
export function sortByAreaOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((id, index) => [id, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id) ?? order.length + a.index;
      const rb = rank.get(b.item.id) ?? order.length + b.index;
      return ra - rb;
    })
    .map(({ item }) => item);
}

// Poe `draggedId` onde `targetId` esta agora, dentro da ordem atual completa
// (`currentIds`, ja ordenada). Devolve a nova lista de ids.
export function moveAreaId(currentIds: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return currentIds;
  const next = currentIds.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1 || !currentIds.includes(draggedId)) return currentIds;
  const draggedIndex = currentIds.indexOf(draggedId);
  const insertAt = draggedIndex < currentIds.indexOf(targetId) ? targetIndex + 1 : targetIndex;
  next.splice(insertAt, 0, draggedId);
  return next;
}
