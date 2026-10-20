import { useEffect, useState } from 'react';

export type ScheduleView = 'week' | 'month';

export const SCHEDULE_VIEWS: readonly ScheduleView[] = ['week', 'month'];
const DEFAULT_VIEW: ScheduleView = 'week';
const STORAGE_KEY = 'pm-schedule-view';

export function isScheduleView(value: string | null): value is ScheduleView {
  return SCHEDULE_VIEWS.some((view) => view === value);
}

function loadView(): ScheduleView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isScheduleView(stored) ? stored : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

// Semana ou mes no Schedule. Mesmo formato de useTableDensity: preferencia
// local, gravada so por conveniencia, e a semana continua a ser o default
// para quem nunca mexeu no botao.
export function useScheduleView() {
  const [view, setView] = useState<ScheduleView>(loadView);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Best-effort only - same reasoning as useTableDensity.
    }
  }, [view]);

  return { view, setView };
}
