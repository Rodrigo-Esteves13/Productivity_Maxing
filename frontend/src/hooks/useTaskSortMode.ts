import {
  DEFAULT_SORT_DIRECTION,
  flipDirection,
  isSortDirection,
  type SortDirection,
} from '../lib/sortDirection';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

export type TaskSortMode = 'manual' | 'date' | 'priority';

const STORAGE_KEY = 'pm-tasks-sort-mode';
const DIRECTION_STORAGE_KEY = 'pm-tasks-sort-direction';
const VALID_MODES: TaskSortMode[] = ['manual', 'date', 'priority'];

const MODE_CODEC: PersistedCodec<TaskSortMode> = {
  parse: (raw) => ((VALID_MODES as string[]).includes(raw ?? '') ? (raw as TaskSortMode) : 'manual'),
};

const DIRECTION_CODEC: PersistedCodec<SortDirection> = {
  parse: (raw) => (isSortDirection(raw) ? raw : DEFAULT_SORT_DIRECTION),
};

// Mesmo padrão de preferência local do useShowArchivedTasks.ts - só decide
// COMO ordenar, nunca vai à API (drag-and-drop continua a persistir a
// ordem manual via /tasks/reorder só quando o modo é 'manual').
export function useTaskSortMode() {
  const [sortMode, setSortMode] = usePersistedState(STORAGE_KEY, MODE_CODEC);
  const [direction, setDirection] = usePersistedState(DIRECTION_STORAGE_KEY, DIRECTION_CODEC);

  const toggleDirection = () => setDirection((current) => flipDirection(current));

  return { sortMode, setSortMode, direction, toggleDirection };
}
