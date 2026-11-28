import { STORAGE_KEYS } from '../lib/storageKeys';
import { OFF_BY_DEFAULT, usePersistedState } from './usePersistedState';

const STORAGE_KEY = STORAGE_KEYS.examMode;

// Modo exame do Dashboard (ver lib/examMode.ts). Mesmo formato de
// useShowArchivedTasks: preferencia local, desligada por omissao.
export function useExamMode() {
  const [isExamMode, setIsExamMode] = usePersistedState(STORAGE_KEY, OFF_BY_DEFAULT);

  return { isExamMode, setIsExamMode };
}
