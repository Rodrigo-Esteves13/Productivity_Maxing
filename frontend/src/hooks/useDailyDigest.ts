import { useEffect, useMemo, useState } from 'react';
import { getUserTasks } from '../api/userService';
import { buildDigest, countOverdue, nearestExam, type DigestLine } from '../lib/dailyDigest';
import { useTodayOverview } from './useTodayOverview';
import type { Task } from '../types/models';

// Se o cartao "Hoje" nunca responder, segue sem ele.
const OVERVIEW_WAIT_MS = 4000;

const COMPLETED: Task['progressStatus'] = 'COMPLETED';

// Linhas do resumo diario a partir dos dados que ja existem (cartao "Hoje" e
// lista de tasks). undefined = a carregar; null = nada a dizer. So montar
// quando o resumo pode mesmo aparecer: faz pedidos.
export function useDailyDigest(now: Date): DigestLine[] | null | undefined {
  const overview = useTodayOverview();
  const [tasks, setTasks] = useState<Task[] | null | undefined>(undefined);

  const [overviewGaveUp, setOverviewGaveUp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOverviewGaveUp(true), OVERVIEW_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getUserTasks(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTasks(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTasks(null);
      });
    return () => controller.abort();
  }, []);

  return useMemo(() => {
    if (tasks === undefined || (!overview && !overviewGaveUp)) return undefined;
    if (!overview && !tasks) return null;
    return buildDigest({
      dueToday: (overview?.dueToday ?? []).filter((task) => task.progressStatus !== COMPLETED).length,
      overdue: tasks ? countOverdue(tasks, now) : 0,
      classesToday: (overview?.agenda ?? []).filter((item) => item.kind === 'class').length,
      exam: tasks ? nearestExam(tasks, now) : null,
    });
  }, [overview, overviewGaveUp, tasks, now]);
}
