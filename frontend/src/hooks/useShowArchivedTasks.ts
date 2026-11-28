import { STORAGE_KEYS } from '../lib/storageKeys';
import { OFF_BY_DEFAULT, usePersistedState } from './usePersistedState';

const STORAGE_KEY = STORAGE_KEYS.showArchivedTasks;

// Same shape as useTableDensity.ts - a small localStorage-backed
// preference, best-effort persisted, defaulting to hidden (archived tasks
// stay out of the way) so nothing changes for anyone who's never touched
// the toggle. Shared between Dashboard and Tasks so the choice carries
// over between the two instead of resetting per page.
export function useShowArchivedTasks() {
  const [showArchived, setShowArchived] = usePersistedState(STORAGE_KEY, OFF_BY_DEFAULT);

  const toggleShowArchived = () => setShowArchived((prev) => !prev);

  return { showArchived, toggleShowArchived };
}
