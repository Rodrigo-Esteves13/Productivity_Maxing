// src/lib/lastUsedArea.ts

// Remembers which Area the Cmd+K quick-add flow last created a task
// under, so typing a title and hitting Enter doesn't require picking an
// Area every single time. Same best-effort localStorage approach as
// useTableDensity / useTasksTableColumnOrder, just one string with no
// reactivity needed elsewhere, so no hook of its own.
const STORAGE_KEY = 'pmaxing-quick-add-last-area';

export function getLastUsedAreaId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLastUsedAreaId(areaId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, areaId);
  } catch {
    // Best-effort only - nothing breaks if storage is unavailable.
  }
}
