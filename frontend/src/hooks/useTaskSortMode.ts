import { useEffect, useState } from 'react';
import {
  DEFAULT_SORT_DIRECTION,
  flipDirection,
  isSortDirection,
  type SortDirection,
} from '../lib/sortDirection';

export type TaskSortMode = 'manual' | 'date' | 'priority';

const STORAGE_KEY = 'pm-tasks-sort-mode';
const DIRECTION_STORAGE_KEY = 'pm-tasks-sort-direction';
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

function loadDirection(): SortDirection {
  try {
    const stored = localStorage.getItem(DIRECTION_STORAGE_KEY);
    return isSortDirection(stored) ? stored : DEFAULT_SORT_DIRECTION;
  } catch {
    return DEFAULT_SORT_DIRECTION;
  }
}

// Mesmo padrão de preferência local do useShowArchivedTasks.ts - só decide
// COMO ordenar, nunca vai à API (drag-and-drop continua a persistir a
// ordem manual via /tasks/reorder só quando o modo é 'manual').
export function useTaskSortMode() {
  const [sortMode, setSortMode] = useState<TaskSortMode>(loadPref);
  const [direction, setDirection] = useState<SortDirection>(loadDirection);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sortMode);
      localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
    } catch {
      // Best-effort only - mesmo raciocínio do useTableDensity.
    }
  }, [sortMode, direction]);

  const toggleDirection = () => setDirection((current) => flipDirection(current));

  return { sortMode, setSortMode, direction, toggleDirection };
}
