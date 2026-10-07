import { useCallback, useState } from 'react';
import { DEFAULT_SORT_DIRECTION, flipDirection, type SortDirection } from '../lib/sortDirection';

export interface TableSortState<K extends string> {
  key: K;
  direction: SortDirection;
}

// Estado de ordenacao de uma tabela: clicar numa coluna nova ordena por ela
// (asc); clicar na mesma coluna inverte a direcao. `null` = ordem original.
export function useTableSort<K extends string>(initial: TableSortState<K> | null = null) {
  const [sort, setSort] = useState<TableSortState<K> | null>(initial);

  const toggleKey = useCallback((key: K) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: flipDirection(current.direction) }
        : { key, direction: DEFAULT_SORT_DIRECTION },
    );
  }, []);

  const setKey = useCallback((key: K | null) => {
    setSort((current) =>
      key === null ? null : { key, direction: current?.direction ?? DEFAULT_SORT_DIRECTION },
    );
  }, []);

  const toggleDirection = useCallback(() => {
    setSort((current) => (current ? { ...current, direction: flipDirection(current.direction) } : current));
  }, []);

  return { sort, toggleKey, setKey, toggleDirection };
}
