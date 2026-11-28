import { toDateKey } from './dateKey';
import { MS_PER_DAY } from './timeConstants';

// Janelas de datas para pedir as tomas avulso. O backend aceita no maximo 62
// dias por pedido (MAX_INTAKE_RANGE_DAYS), por isso um periodo maior vai em
// varios pedidos.
export const INTAKE_WINDOW_DAYS = 61;
export const MAX_INTAKE_HISTORY_DAYS = 365;

export interface DateWindow {
  from: string;
  to: string;
}

/** Os ultimos `days` dias (inclui `today`), da janela mais recente para a mais antiga. */
export function intakeWindows(today: string, days: number): DateWindow[] {
  const end = Date.parse(today);
  const keyBefore = (offset: number) => toDateKey(new Date(end - offset * MS_PER_DAY));
  const windows: DateWindow[] = [];
  for (let start = 0; start < days; start += INTAKE_WINDOW_DAYS) {
    const last = Math.min(days, start + INTAKE_WINDOW_DAYS) - 1;
    windows.push({ from: keyBefore(last), to: keyBefore(start) });
  }
  return windows;
}
