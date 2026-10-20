import { useEffect, useState } from 'react';
import { getTodayTasks } from '../api/studySessionsService';
import { getSchedule } from '../api/scheduleService';
import { getWorkShiftRange } from '../api/workShiftsService';
import { getStudyPlan } from '../api/studyPlanService';
import { mergeAgenda, type AgendaItem } from '../lib/agenda';
import { toDateKey } from '../lib/dateKey';
import { todayUtcAnchored } from '../lib/weekDates';
import type { StudyPlanSuggestion, Task } from '../types/models';

// So o dia de hoje: o plano de estudo e o pedido mais pesado, e aqui so
// interessam os blocos de hoje.
const STUDY_PLAN_DAYS = 1;

export interface TodayOverview {
  dueToday: Task[];
  agenda: AgendaItem[];
  studyBlocks: StudyPlanSuggestion[];
}

const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

// Dados do cartao "Hoje": tasks que vencem hoje (/tasks/today), aulas e
// turnos de hoje e os blocos de estudo do plano. Cada parte e best-effort:
// se uma falhar o cartao mostra as outras; se falharem todas fica null e o
// cartao nao aparece (como o StudyCapacityCard).
export function useTodayOverview() {
  const [overview, setOverview] = useState<TodayOverview | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const key = toDateKey(todayUtcAnchored());
    void Promise.allSettled([
      getTodayTasks(),
      getSchedule(key, key, controller.signal),
      getWorkShiftRange(key, key),
      getStudyPlan(STUDY_PLAN_DAYS, controller.signal),
    ]).then(([due, classes, shifts, plan]) => {
      if (controller.signal.aborted) return;
      if ([due, classes, shifts, plan].every((result) => result.status === 'rejected')) return;
      setOverview({
        dueToday: valueOr(due, []),
        agenda: mergeAgenda(valueOr(classes, []), valueOr(shifts, [])),
        studyBlocks: plan.status === 'fulfilled' ? plan.value.suggestions : [],
      });
    });
    return () => controller.abort();
  }, []);

  return overview;
}
