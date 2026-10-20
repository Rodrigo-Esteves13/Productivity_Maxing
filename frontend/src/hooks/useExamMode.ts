import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pm-exam-mode';

function loadExamMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Modo exame do Dashboard (ver lib/examMode.ts). Mesmo formato de
// useShowArchivedTasks: preferencia local, desligada por omissao.
export function useExamMode() {
  const [isExamMode, setIsExamMode] = useState<boolean>(loadExamMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isExamMode));
    } catch {
      // Best-effort only - same reasoning as useTableDensity.
    }
  }, [isExamMode]);

  return { isExamMode, setIsExamMode };
}
