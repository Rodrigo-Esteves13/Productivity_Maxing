import { useEffect, useMemo, useState } from 'react';
import { getAreaTeachers } from '../api/areaTeachersService';
import { getCourseRiskOverview } from '../api/courseRiskService';
import { getUserTasks } from '../api/userService';
import { useAcademic } from '../context/useAcademic';
import { isRequestCanceled } from '../lib/abortable';
import { buildAreaOverview, type AreaOverviewItem } from '../lib/areaOverview';
import type { AreaTeacherNote, CourseRiskOverview, Task } from '../types/models';

export type { AreaOverviewItem };

// Resumo opcional por cadeira para a pagina Areas: um pedido por fonte (tarefas
// do periodo, risco, docentes), sem pedidos por area. Qualquer falha vira
// `failed` e a fonte fica vazia; a pagina funciona sem isto.
export function useAreaOverview(): {
  byAreaId: Map<string, AreaOverviewItem>;
  isLoading: boolean;
  failed: boolean;
} {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const viewingAll = isViewingAllPeriods || isViewingAllPrograms;
  const periodParam = viewingAll ? 'all' : activePeriod?.id;
  const riskPeriodId = viewingAll ? undefined : activePeriod?.id;

  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [risk, setRisk] = useState<CourseRiskOverview | null>(null);
  const [teachers, setTeachers] = useState<AreaTeacherNote[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isAcademicLoading) return;
    const controller = new AbortController();
    let anyFailed = false;
    const swallow = <T,>(request: Promise<T>): Promise<T | null> =>
      request.catch((caught: unknown) => {
        if (!isRequestCanceled(caught)) anyFailed = true;
        return null;
      });
    setIsLoading(true);
    void Promise.all([
      swallow(getUserTasks(periodParam, controller.signal)),
      swallow(getCourseRiskOverview({ periodId: riskPeriodId }, controller.signal)),
      swallow(getAreaTeachers()),
    ]).then(([taskRows, riskData, teacherRows]) => {
      if (controller.signal.aborted) return;
      setTasks(taskRows);
      setRisk(riskData);
      setTeachers(teacherRows);
      setFailed(anyFailed);
      setIsLoading(false);
    });
    return () => controller.abort();
  }, [isAcademicLoading, periodParam, riskPeriodId]);

  const byAreaId = useMemo(() => buildAreaOverview(tasks, risk, teachers), [tasks, risk, teachers]);
  return { byAreaId, isLoading, failed };
}
