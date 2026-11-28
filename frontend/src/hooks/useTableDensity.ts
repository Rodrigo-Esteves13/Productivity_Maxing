import { usePersistedState, type PersistedCodec } from './usePersistedState';

export type TableDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'dashboard-table-density';

const CODEC: PersistedCodec<TableDensity> = {
  parse: (raw) => (raw === 'compact' ? 'compact' : 'comfortable'),
};

// Same shape as useDashboardWidgetPrefs - a small localStorage-backed
// preference, best-effort persisted, defaulting to today's spacing
// (comfortable) so nothing changes for anyone who's never touched the
// toggle.
export function useTableDensity() {
  const [density, setDensity] = usePersistedState(STORAGE_KEY, CODEC);

  const toggleDensity = () => {
    setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  return { density, toggleDensity };
}
