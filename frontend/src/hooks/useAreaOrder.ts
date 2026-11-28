import { useCallback } from 'react';
import { moveAreaId, sortByAreaOrder } from '../lib/areaOrder';
import { ACCOUNT_SCOPED_KEYS, accountStorageKey } from '../lib/storageKeys';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

const NO_ORDER: string[] = [];

const CODEC: PersistedCodec<string[]> = {
  parse: (raw) => {
    if (!raw) return NO_ORDER;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : NO_ORDER;
    } catch {
      return NO_ORDER;
    }
  },
  serialize: (order) => (order.length === 0 ? null : JSON.stringify(order)),
};

// Ordem manual das Areas, so neste browser e por conta (mesmo padrao do
// useTasksTableColumnOrder). Usada na pagina Areas (onde se arrasta) e nos
// seletores de Area do formulario de task e dos filtros do Dashboard.
export function useAreaOrder() {
  const [order, setOrder] = usePersistedState(accountStorageKey(ACCOUNT_SCOPED_KEYS.areaOrder), CODEC);

  const sortAreas = useCallback(<T extends { id: string }>(items: T[]) => sortByAreaOrder(items, order), [order]);

  // `currentIds`: todas as Areas pela ordem em que estao a ser mostradas.
  const moveArea = useCallback((currentIds: string[], draggedId: string, targetId: string) => {
    setOrder(moveAreaId(currentIds, draggedId, targetId));
  }, [setOrder]);

  const resetOrder = useCallback(() => setOrder(NO_ORDER), [setOrder]);

  return { sortAreas, moveArea, resetOrder, isCustom: order.length > 0 };
}
