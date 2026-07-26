import { useEffect, useState } from 'react';
import type { DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';

export interface SavedFilterView {
  id: string;
  name: string;
  filters: DashboardFiltersState;
}

const STORAGE_KEY = 'dashboard-saved-filter-views';

function loadViews(): SavedFilterView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Same local-only pattern as useDashboardWidgetPrefs - a named filter
// preset is a personal shortcut, not something that needs to sync
// across devices or be visible to anyone else, so it doesn't need a
// backend endpoint or a schema change.
export function useSavedFilterViews() {
  const [views, setViews] = useState<SavedFilterView[]>(loadViews);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } catch {
      // Best-effort only - a user with storage disabled/full just doesn't
      // get saved views remembered across reloads, nothing breaks.
    }
  }, [views]);

  const saveView = (name: string, filters: DashboardFiltersState) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setViews((prev) => [...prev, { id, name, filters }]);
  };

  const deleteView = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  return { views, saveView, deleteView };
}
