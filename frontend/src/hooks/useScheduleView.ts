import { usePersistedState, type PersistedCodec } from './usePersistedState';

export type ScheduleView = 'week' | 'month';

export const SCHEDULE_VIEWS: readonly ScheduleView[] = ['week', 'month'];
const DEFAULT_VIEW: ScheduleView = 'week';
const STORAGE_KEY = 'pm-schedule-view';

export function isScheduleView(value: string | null): value is ScheduleView {
  return SCHEDULE_VIEWS.some((view) => view === value);
}

const CODEC: PersistedCodec<ScheduleView> = {
  parse: (raw) => (isScheduleView(raw) ? raw : DEFAULT_VIEW),
};

// Semana ou mes no Schedule. Mesmo formato de useTableDensity: preferencia
// local, gravada so por conveniencia, e a semana continua a ser o default
// para quem nunca mexeu no botao.
export function useScheduleView() {
  const [view, setView] = usePersistedState(STORAGE_KEY, CODEC);

  return { view, setView };
}
