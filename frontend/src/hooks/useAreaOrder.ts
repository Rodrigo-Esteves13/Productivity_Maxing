import { useCallback, useEffect, useState } from 'react';
import { moveAreaId, sortByAreaOrder } from '../lib/areaOrder';

const STORAGE_KEY = 'pm-area-order';

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

// Ordem manual das Areas, so neste browser (mesmo padrao do
// useTasksTableColumnOrder). Usada na pagina Areas (onde se arrasta) e nos
// seletores de Area do formulario de task e dos filtros do Dashboard.
export function useAreaOrder() {
  const [order, setOrder] = useState<string[]>(loadOrder);

  useEffect(() => {
    try {
      if (order.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Best-effort only, same as every other localStorage pref in this app.
    }
  }, [order]);

  const sortAreas = useCallback(<T extends { id: string }>(items: T[]) => sortByAreaOrder(items, order), [order]);

  // `currentIds`: todas as Areas pela ordem em que estao a ser mostradas.
  const moveArea = useCallback((currentIds: string[], draggedId: string, targetId: string) => {
    setOrder(moveAreaId(currentIds, draggedId, targetId));
  }, []);

  const resetOrder = useCallback(() => setOrder([]), []);

  return { sortAreas, moveArea, resetOrder, isCustom: order.length > 0 };
}
