import { useAcademic } from '../context/useAcademic';
import { toDateKey, todayKey } from '../lib/dateKey';
import { addUtcDays, todayUtcAnchored } from '../lib/weekDates';

// Sem periodo ativo (vista "todos os periodos"): ultimos ~6 meses.
const FALLBACK_DAYS = 183;

// Intervalo "YYYY-MM-DD" do periodo ativo, usado pelos cartoes do Schedule
// que resumem o semestre (presencas, estudo vs aulas).
export function useActivePeriodRange(): { from: string; to: string } {
  const { activePeriod } = useAcademic();
  const from = activePeriod
    ? activePeriod.startDate.slice(0, 10)
    : toDateKey(addUtcDays(todayUtcAnchored(), -FALLBACK_DAYS));
  const to = activePeriod?.endDate?.slice(0, 10) ?? todayKey();
  return { from, to };
}
