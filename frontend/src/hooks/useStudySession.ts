import { useCallback, useEffect, useState } from 'react';
import { getUserAreas, getUserTasks } from '../api/userService';
import type { Area, Task } from '../types/models';
import { useActiveStudySession } from '../context/useActiveStudySession';

// The active-session part (activeSession/elapsedSeconds/start/stop) now
// lives in StudySessionProvider (see src/context) - shared with
// GlobalStudyTimer.tsx, the mini timer visible on every page, so it and
// the Focus page's full widget are always looking at exactly the same
// running session instead of two independent pollers. This hook adds only
// what's specific to the Focus page itself: the areas/tasks pickers used
// to start a new session.
export function useStudySession() {
  const {
    activeSession,
    elapsedSeconds,
    isSubmitting,
    error: sessionError,
    start,
    stop,
  } = useActiveStudySession();

  // TODAS as tasks pendentes (não só as de hoje) - estudar com antecedência
  // para uma prova/entrega futura é o caso normal, não a exceção (ver
  // pedido do Rodrigo: "eu não estudo para um teste no próprio dia"). O
  // Today's Plan (useTodayPlan) continua a existir para o que É só de
  // hoje; isto aqui é uma lista separada, deliberadamente mais larga.
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      // getUserTasks() sem periodId = período ativo do user (mesmo default
      // do resto da app) - não faz sentido oferecer aqui tasks de
      // semestres antigos já arquivados.
      const [areasData, tasksData] = await Promise.all([
        getUserAreas(),
        getUserTasks(),
      ]);
      // Area é um catálogo global (schema.prisma: sem periodId nem
      // programId - serve tanto para cadeiras como para "Natação",
      // "Condução", etc.), por isso não há como filtrar "as cadeiras
      // deste semestre" diretamente na tabela. O sinal que existe é
      // indireto: que Areas têm pelo menos uma task no período ativo
      // (tasksData já vem filtrado a esse período, ver getUserTasks()
      // acima). Uma cadeira nova sem tasks ainda não aparece aqui - é a
      // limitação real desta abordagem sem mexer no schema.
      const areaIdsInPeriod = new Set(tasksData.map((t) => t.areaId));
      setAreas(areasData.filter((a) => areaIdsInPeriod.has(a.id)));
      setTasks(
        tasksData
          .filter((t) => t.progressStatus !== 'COMPLETED')
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
    } catch {
      setError('Could not load the study session.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  return {
    activeSession,
    areas,
    tasks,
    elapsedSeconds,
    isLoading,
    isSubmitting,
    error: error || sessionError,
    start,
    stop,
  };
}
