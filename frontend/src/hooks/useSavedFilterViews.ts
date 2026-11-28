import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { EMPTY_DASHBOARD_FILTERS, type DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import { ACCOUNT_SCOPED_KEYS, accountStorageKey } from '../lib/storageKeys';

export interface SavedFilterView {
  id: string;
  name: string;
  filters: DashboardFiltersState;
}

const NO_VIEWS: SavedFilterView[] = [];

const CODEC: PersistedCodec<SavedFilterView[]> = {
  parse: (raw) => {
    if (!raw) return NO_VIEWS;
    try {
      // Vistas gravadas antes de existirem campos novos (esforco, prontidao)
      // ficam sem eles: completa com os vazios.
      const parsed = JSON.parse(raw) as SavedFilterView[];
      return parsed.map((view) => ({ ...view, filters: { ...EMPTY_DASHBOARD_FILTERS, ...view.filters } }));
    } catch {
      return NO_VIEWS;
    }
  },
  serialize: (views) => JSON.stringify(views),
};

// Same local-only pattern as useDashboardWidgetPrefs - a named filter
// preset is a personal shortcut, not something that needs to sync
// across devices or be visible to anyone else, so it doesn't need a
// backend endpoint or a schema change.
export function useSavedFilterViews() {
  const [views, setViews] = usePersistedState(accountStorageKey(ACCOUNT_SCOPED_KEYS.savedFilterViews), CODEC);

  const saveView = (name: string, filters: DashboardFiltersState) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setViews((prev) => [...prev, { id, name, filters }]);
  };

  const deleteView = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  return { views, saveView, deleteView };
}
