import { useEffect, useMemo, useRef, useState } from 'react';
import type { GradeComponent } from '../types/models';
import { getGradeComponents } from '../api/gradeComponentsService';
import { useAcademic } from '../context/useAcademic';
import { usePlanMode } from './usePlanMode';
import { useDomainVersion } from './useDomainVersion';
import type { DataDomain } from '../lib/domainEvents';

const COMPONENT_DOMAINS: readonly DataDomain[] = ['grades'];

// Componentes de nota (seminarios, participacao...) de TODAS as cadeiras do
// periodo ativo, ou de todos os periodos na vista agregada. Falha em
// silencio: sem isto o cartao continua a funcionar so com tasks.
export function usePeriodGradeComponents(): GradeComponent[] {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  const [components, setComponents] = useState<GradeComponent[]>([]);
  // Uma nota gravada noutro sitio volta a ler em silencio.
  const version = useDomainVersion(COMPONENT_DOMAINS);
  // Periodo dos componentes mostrados: uma releitura falhada do mesmo periodo
  // mantem-nos em vez de os esvaziar.
  const loadedForRef = useRef<string | null>(null);
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  const isWaitingForPeriod = !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;

  useEffect(() => {
    if (isWaitingForPeriod) return;
    let cancelled = false;
    const loadKey = periodId ?? '';
    getGradeComponents({ periodId })
      .then((data) => {
        if (cancelled) return;
        loadedForRef.current = loadKey;
        setComponents(data);
      })
      .catch(() => {
        if (!cancelled && loadedForRef.current !== loadKey) setComponents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId, isWaitingForPeriod, version]);

  // Modo plano do Dashboard: as entradas em falta ficam com a mediana.
  const { planComponents } = usePlanMode();
  return useMemo(() => planComponents(components), [planComponents, components]);
}
