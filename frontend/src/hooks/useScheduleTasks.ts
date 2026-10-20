import { useEffect, useState } from 'react';
import { getUserTasks } from '../api/userService';
import { isRequestCanceled } from '../lib/abortable';
import { translateNow } from '../i18n/translate';
import type { Task } from '../types/models';

// 'all' = tasks de todos os periodos (ver getUserTasks): ao andar para
// semanas ou meses de outro semestre os prazos desse semestre tambem aparecem.
const ALL_PERIODS = 'all';

// Prazos das tasks para o horario (vista semanal e mensal). O backend nao
// filtra tasks por datas, por isso vem tudo uma vez por montagem e cada
// vista escolhe os dias que mostra.
export function useScheduleTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getUserTasks(ALL_PERIODS, controller.signal)
      .then((data) => {
        setTasks(data);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setError(translateNow('hook.couldNotLoadTheSchedule'));
        setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { tasks, isLoading, error };
}
