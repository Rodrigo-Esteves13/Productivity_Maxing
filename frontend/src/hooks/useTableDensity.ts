import { useEffect, useState } from 'react';

export type TableDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'dashboard-table-density';

function loadDensity(): TableDensity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

// Same shape as useDashboardWidgetPrefs - a small localStorage-backed
// preference, best-effort persisted, defaulting to today's spacing
// (comfortable) so nothing changes for anyone who's never touched the
// toggle.
export function useTableDensity() {
  const [density, setDensity] = useState<TableDensity>(loadDensity);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // Best-effort only - see useDashboardWidgetPrefs for the same
      // reasoning.
    }
  }, [density]);

  const toggleDensity = () => {
    setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  return { density, toggleDensity };
}
