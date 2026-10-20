import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSchedule } from '../api/scheduleService';
import { isRequestCanceled } from '../lib/abortable';
import { addUtcMonths, monthGridDays, startOfMonth } from '../lib/monthGrid';
import { buildMonthAgenda } from '../lib/monthAgenda';
import { todayUtcAnchored } from '../lib/weekDates';
import { translateNow } from '../i18n/translate';
import type { ClassOccurrence } from '../types/models';
import { useWorkShiftRange } from './useWorkShiftRange';
import { useScheduleTasks } from './useScheduleTasks';

// Dados da vista mensal: as mesmas aulas (/schedule) e turnos
// (/work-shifts/range) da grelha semanal, so que para as 4 a 6 semanas da
// grelha do mes, mais os prazos das tasks (useScheduleTasks).
export function useMonthAgenda(initialDate: Date, refreshKey: number) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(initialDate));
  const [classes, setClasses] = useState<ClassOccurrence[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState('');
  const { tasks, isLoading: isLoadingTasks, error: tasksError } = useScheduleTasks();

  const days = useMemo(() => monthGridDays(monthStart), [monthStart]);
  const fromKey = days[0].key;
  const toKey = days[days.length - 1].key;

  const fetchClasses = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoadingClasses(true);
        setClassesError('');
        setClasses(await getSchedule(fromKey, toKey, signal));
        setIsLoadingClasses(false);
      } catch (caught) {
        // Mudar de mes depressa cancela o pedido anterior: nao e um erro.
        if (isRequestCanceled(caught)) return;
        setClassesError(translateNow('hook.couldNotLoadTheSchedule'));
        setIsLoadingClasses(false);
      }
    },
    [fromKey, toKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchClasses(controller.signal);
    return () => controller.abort();
  }, [fetchClasses, refreshKey]);

  const shifts = useWorkShiftRange(fromKey, toKey, refreshKey);

  const chipsByDay = useMemo(() => {
    const visible = tasks.filter((task) => {
      const key = task.date.slice(0, 10);
      return key >= fromKey && key <= toKey;
    });
    return buildMonthAgenda(visible, classes, shifts);
  }, [tasks, classes, shifts, fromKey, toKey]);

  const goToPreviousMonth = () => setMonthStart((current) => addUtcMonths(current, -1));
  const goToNextMonth = () => setMonthStart((current) => addUtcMonths(current, 1));
  const goToCurrentMonth = () => setMonthStart(startOfMonth(todayUtcAnchored()));

  return {
    monthStart,
    days,
    chipsByDay,
    isLoading: isLoadingClasses || isLoadingTasks,
    error: classesError || tasksError,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  };
}
