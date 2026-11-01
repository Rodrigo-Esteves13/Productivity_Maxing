import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_AREA_FILTER,
  DEFAULT_AREA_SORT,
  isAreaFilter,
  isAreaSort,
  type AreaFilter,
  type AreaSort,
} from '../lib/areaList';

const STORAGE_KEY = 'pm-area-list-prefs';

interface AreaListPrefs {
  filter: AreaFilter;
  sort: AreaSort;
}

const DEFAULT_PREFS: AreaListPrefs = { filter: DEFAULT_AREA_FILTER, sort: DEFAULT_AREA_SORT };

function loadPrefs(): AreaListPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof AreaListPrefs, unknown>>;
    return {
      filter: isAreaFilter(parsed.filter) ? parsed.filter : DEFAULT_AREA_FILTER,
      sort: isAreaSort(parsed.sort) ? parsed.sort : DEFAULT_AREA_SORT,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Filtro e ordenacao da pagina Areas, so neste browser (mesmo padrao do
// useAreaOrder / useDashboardWidgetPrefs). Valores invalidos voltam ao defeito.
export function useAreaListPrefs() {
  const [prefs, setPrefs] = useState<AreaListPrefs>(loadPrefs);

  useEffect(() => {
    try {
      const isDefault = prefs.filter === DEFAULT_AREA_FILTER && prefs.sort === DEFAULT_AREA_SORT;
      if (isDefault) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Best-effort only, same as every other localStorage pref in this app.
    }
  }, [prefs]);

  const setFilter = useCallback((filter: AreaFilter) => setPrefs((prev) => ({ ...prev, filter })), []);
  const setSort = useCallback((sort: AreaSort) => setPrefs((prev) => ({ ...prev, sort })), []);
  const resetPrefs = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return { filter: prefs.filter, sort: prefs.sort, setFilter, setSort, resetPrefs };
}
