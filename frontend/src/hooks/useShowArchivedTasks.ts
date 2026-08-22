import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pm-show-archived-tasks';

function loadPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Same shape as useTableDensity.ts - a small localStorage-backed
// preference, best-effort persisted, defaulting to hidden (archived tasks
// stay out of the way) so nothing changes for anyone who's never touched
// the toggle. Shared between Dashboard and Tasks so the choice carries
// over between the two instead of resetting per page.
export function useShowArchivedTasks() {
  const [showArchived, setShowArchived] = useState<boolean>(loadPref);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(showArchived));
    } catch {
      // Best-effort only - same reasoning as useTableDensity.
    }
  }, [showArchived]);

  const toggleShowArchived = () => setShowArchived((prev) => !prev);

  return { showArchived, toggleShowArchived };
}
