import { useEffect, useState } from 'react';

export type TaskSortMode = 'manual' | 'date' | 'priority';

const STORAGE_KEY = 'pm-tasks-sort-mode';
const VALID_MODES: TaskSortMode[] = ['manual', 'date', 'priority'];

function loadPref(): TaskSortMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (VALID_MODES as string[]).includes(stored ?? '')
      ? (stored as TaskSortMode)
      : 'manual';
  } catch {
    return 'manual';
  }
}

// Mesmo padrão de preferência local do useShowArchivedTasks.ts - só decide
// COMO ordenar, nunca vai à API (drag-and-drop continua a persistir a
// ordem manual via /tasks/reorder só quando o modo é 'manual').
export function useTaskSortMode() {
  const [sortMode, setSortMode] = useState<TaskSortMode>(loadPref);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sortMode);
    } catch {
      // Best-effort only - mesmo raciocínio do useTableDensity.
    }
  }, [sortMode]);

  return { sortMode, setSortMode };
}
