import { useEffect, useState } from 'react';

export type TasksView = 'grid' | 'board';

export const TASKS_VIEWS: readonly TasksView[] = ['grid', 'board'];
const DEFAULT_VIEW: TasksView = 'grid';
const STORAGE_KEY = 'pm-tasks-view';

export function isTasksView(value: string | null): value is TasksView {
  return TASKS_VIEWS.some((view) => view === value);
}

function loadView(): TasksView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTasksView(stored) ? stored : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

// Grelha de cartoes ou quadro Kanban (colunas por estado) na pagina Tasks.
// Mesmo formato de useScheduleView: preferencia local, a grelha continua a
// ser o default para quem nunca mexeu no botao.
export function useTasksView() {
  const [view, setView] = useState<TasksView>(loadView);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Best-effort only - same reasoning as useTableDensity.
    }
  }, [view]);

  return { view, setView };
}
