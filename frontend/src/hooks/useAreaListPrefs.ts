import { useCallback } from 'react';
import {
  DEFAULT_AREA_FILTER,
  DEFAULT_AREA_SORT,
  isAreaFilter,
  isAreaSort,
  type AreaFilter,
  type AreaSort,
} from '../lib/areaList';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

const STORAGE_KEY = 'pm-area-list-prefs';

interface AreaListPrefs {
  filter: AreaFilter;
  sort: AreaSort;
}

const DEFAULT_PREFS: AreaListPrefs = { filter: DEFAULT_AREA_FILTER, sort: DEFAULT_AREA_SORT };

const CODEC: PersistedCodec<AreaListPrefs> = {
  parse: (raw) => {
    if (!raw) return DEFAULT_PREFS;
    try {
      const parsed = JSON.parse(raw) as Partial<Record<keyof AreaListPrefs, unknown>>;
      return {
        filter: isAreaFilter(parsed.filter) ? parsed.filter : DEFAULT_AREA_FILTER,
        sort: isAreaSort(parsed.sort) ? parsed.sort : DEFAULT_AREA_SORT,
      };
    } catch {
      return DEFAULT_PREFS;
    }
  },
  serialize: (prefs) =>
    prefs.filter === DEFAULT_AREA_FILTER && prefs.sort === DEFAULT_AREA_SORT ? null : JSON.stringify(prefs),
};

// Filtro e ordenacao da pagina Areas, so neste browser (mesmo padrao do
// useAreaOrder / useDashboardWidgetPrefs). Valores invalidos voltam ao defeito.
export function useAreaListPrefs() {
  const [prefs, setPrefs] = usePersistedState(STORAGE_KEY, CODEC);

  const setFilter = useCallback((filter: AreaFilter) => setPrefs((prev) => ({ ...prev, filter })), [setPrefs]);
  const setSort = useCallback((sort: AreaSort) => setPrefs((prev) => ({ ...prev, sort })), [setPrefs]);
  const resetPrefs = useCallback(() => setPrefs(DEFAULT_PREFS), [setPrefs]);

  return { filter: prefs.filter, sort: prefs.sort, setFilter, setSort, resetPrefs };
}
