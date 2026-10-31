import { useCallback, useEffect, useState } from 'react';
import { getOverdueCheckins, confirmOverdueTask, type OverdueAnswer } from '../api/userService';
import type { Task } from '../types/models';
import { todayKey } from '../lib/dateKey';
import { readOverdueCheckDay, writeOverdueCheckDay } from '../lib/overdueCheckKey';
import { askIfFinishedOnTime } from '../lib/onTimeQuestion';

// O backend e sempre quem decide quais tasks ainda faltam confirmar
// (lastOverdueCheckAt). A marca do dia em localStorage (por utilizador) so
// evita pedir outra vez depois de a fila ficar respondida ou adiada hoje.
// So e gravada nesse momento: antes era gravada mal chegava a resposta
// (mesmo com o pedido cancelado por mudar de pagina) e o resto da fila
// desaparecia ate ao dia seguinte.

interface UseOverdueCheckinsReturn {
  pendingTasks: Task[];
  currentTask: Task | null;
  isAnswering: boolean;
  // true quando a ultima resposta falhou (offline, erro do servidor).
  hasError: boolean;
  answer: (response: OverdueAnswer) => Promise<void>;
  // "Perguntar mais tarde": fecha a fila por hoje neste browser. As tasks
  // continuam por responder no backend e voltam amanha.
  dismiss: () => void;
}

export function useOverdueCheckins(userId: string | null | undefined): UseOverdueCheckinsReturn {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPendingTasks([]);
      return;
    }
    if (readOverdueCheckDay(userId) === todayKey()) return;

    let cancelled = false;
    getOverdueCheckins()
      .then((tasks) => {
        if (cancelled) return;
        setPendingTasks(tasks);
        // Nada a perguntar: nao vale a pena pedir de novo hoje.
        if (tasks.length === 0) writeOverdueCheckDay(userId, todayKey());
      })
      .catch((error: unknown) => {
        // Falhar aqui nunca deve impedir o resto da app de funcionar -
        // tenta outra vez na proxima pagina.
        console.error('Failed to load overdue check-ins:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const answer = useCallback(
    async (response: OverdueAnswer) => {
      const current = pendingTasks[0];
      if (!current || isAnswering) return;

      setIsAnswering(true);
      try {
        await confirmOverdueTask(current.id, response);
        setHasError(false);
        // "Ja esta feita" numa task fora de prazo: pode ter sido a tempo
        // (so faltou marcar).
        if (response.isCompleted) askIfFinishedOnTime([current]);
        const rest = pendingTasks.slice(1);
        setPendingTasks(rest);
        if (rest.length === 0 && userId) writeOverdueCheckDay(userId, todayKey());
      } catch (error: unknown) {
        console.error('Failed to confirm overdue task:', error);
        // Mantemos a task na fila e mostramos o erro no modal (com a
        // opcao "Perguntar mais tarde" para nao ficar preso).
        setHasError(true);
      } finally {
        setIsAnswering(false);
      }
    },
    [pendingTasks, isAnswering, userId],
  );

  const dismiss = useCallback(() => {
    setPendingTasks([]);
    setHasError(false);
    if (userId) writeOverdueCheckDay(userId, todayKey());
  }, [userId]);

  return {
    pendingTasks,
    currentTask: pendingTasks[0] ?? null,
    isAnswering,
    hasError,
    answer,
    dismiss,
  };
}
