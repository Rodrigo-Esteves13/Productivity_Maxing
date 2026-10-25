import { useEffect, useMemo, useState } from 'react';
import type { GradeComponent } from '../types/models';
import { getGradeComponents } from '../api/gradeComponentsService';
import { useAcademic } from '../context/useAcademic';
import { usePlanMode } from './usePlanMode';

// Componentes de nota (seminarios, participacao...) de TODAS as cadeiras do
// periodo ativo, ou de todos os periodos na vista agregada. Falha em
// silencio: sem isto o cartao continua a funcionar so com tasks.
export function usePeriodGradeComponents(): GradeComponent[] {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  const isWaitingForPeriod = !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;

  useEffect(() => {
    if (isWaitingForPeriod) return;
    let cancelled = false;
    getGradeComponents({ periodId })
      .then((data) => {
        if (!cancelled) setComponents(data);
      })
      .catch(() => {
        if (!cancelled) setComponents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId, isWaitingForPeriod]);

  // Modo plano do Dashboard: as entradas em falta ficam com a mediana.
  const { planComponents } = usePlanMode();
  return useMemo(() => planComponents(components), [planComponents, components]);
}
