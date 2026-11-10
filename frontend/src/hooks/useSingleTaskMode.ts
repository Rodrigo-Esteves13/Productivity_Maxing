import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pm-single-task-mode';

function loadSingleTaskMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Modo "uma so task" do Dashboard (ver lib/mostUrgentTask.ts). Preferencia
// local do browser, desligada por omissao.
export function useSingleTaskMode() {
  const [isSingleTaskMode, setIsSingleTaskMode] = useState<boolean>(loadSingleTaskMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isSingleTaskMode));
    } catch {
      // Best-effort only - same reasoning as useExamMode.
    }
  }, [isSingleTaskMode]);

  return { isSingleTaskMode, setIsSingleTaskMode };
}
