import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserTasks } from '../api/tasksService';
import { isRequestCanceled } from '../lib/abortable';
import { translateNow } from '../i18n/translate';
import { TASK_DOMAINS } from '../lib/domainEvents';
import type { Task } from '../types/models';
import { useDomainVersion } from './useDomainVersion';

// 'all' = tasks de todos os periodos (ver getUserTasks): ao andar para
// semanas ou meses de outro semestre os prazos desse semestre tambem aparecem.
const ALL_PERIODS = 'all';

export interface ScheduleTasksState {
  tasks: Task[];
  isLoading: boolean;
  error: string;
  /** Tentar de novo depois de uma falha. */
  reload: () => void;
}

// Prazos das tasks para o horario (vista semanal e mensal). O backend nao
// filtra tasks por datas, por isso vem tudo de uma vez: o hook vive na pagina
// (Schedule.tsx), para alternar de vista nao repetir o pedido. Volta a pedir,
// em silencio, quando as tasks mudam noutro cartao.
export function useScheduleTasks(): ScheduleTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const tasksVersion = useDomainVersion(TASK_DOMAINS);
  const hasTasksRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getUserTasks(ALL_PERIODS, controller.signal)
      .then((data) => {
        hasTasksRef.current = true;
        setTasks(data);
        setError('');
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        // Um refresco falhado mantem os prazos que ja estavam no ecra.
        if (!hasTasksRef.current) setError(translateNow('hook.couldNotLoadTheSchedule'));
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [tasksVersion, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { tasks, isLoading, error, reload };
}
