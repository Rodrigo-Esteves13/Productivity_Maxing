import { STORAGE_KEYS } from '../lib/storageKeys';
import { OFF_BY_DEFAULT, usePersistedState } from './usePersistedState';

const STORAGE_KEY = STORAGE_KEYS.singleTaskMode;

// Modo "uma so task" do Dashboard (ver lib/mostUrgentTask.ts). Preferencia
// local do browser, desligada por omissao.
export function useSingleTaskMode() {
  const [isSingleTaskMode, setIsSingleTaskMode] = usePersistedState(STORAGE_KEY, OFF_BY_DEFAULT);

  return { isSingleTaskMode, setIsSingleTaskMode };
}
