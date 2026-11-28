import { usePersistedState, type PersistedCodec } from './usePersistedState';

export type TasksView = 'grid' | 'board' | 'timeline' | 'matrix';

export const TASKS_VIEWS: readonly TasksView[] = ['grid', 'board', 'timeline', 'matrix'];
const DEFAULT_VIEW: TasksView = 'grid';
const STORAGE_KEY = 'pm-tasks-view';

export function isTasksView(value: string | null): value is TasksView {
  return TASKS_VIEWS.some((view) => view === value);
}

const CODEC: PersistedCodec<TasksView> = {
  parse: (raw) => (isTasksView(raw) ? raw : DEFAULT_VIEW),
};

// Grelha de cartoes ou quadro Kanban (colunas por estado) na pagina Tasks.
// Mesmo formato de useScheduleView: preferencia local, a grelha continua a
// ser o default para quem nunca mexeu no botao.
export function useTasksView() {
  const [view, setView] = usePersistedState(STORAGE_KEY, CODEC);

  return { view, setView };
}
