import { useCallback, useEffect, useState } from 'react';
import { getOverdueCheckins, confirmOverdueTask } from '../api/userService';
import type { Task } from '../types/models';

// Chave de localStorage usada só para evitar disparar o pedido de rede a
// cada mudança de página no mesmo dia - o backend é sempre quem decide de
// facto quais tasks ainda faltam confirmar (lastOverdueCheckAt), isto é só
// uma otimização client-side.
const LAST_CHECK_KEY = 'pmaxing:lastOverdueCheckDate';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

interface UseOverdueCheckinsReturn {
  pendingTasks: Task[];
  currentTask: Task | null;
  isAnswering: boolean;
  answer: (isCompleted: boolean) => Promise<void>;
}

export function useOverdueCheckins(isEnabled: boolean): UseOverdueCheckinsReturn {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;

    // Já verificámos hoje neste browser - não vale a pena pedir outra vez
    // até o dia mudar (o utilizador pode ter respondido a tudo na sessão
    // anterior).
    if (localStorage.getItem(LAST_CHECK_KEY) === todayKey()) return;

    let cancelled = false;
    getOverdueCheckins()
      .then((tasks) => {
        if (!cancelled) setPendingTasks(tasks);
        localStorage.setItem(LAST_CHECK_KEY, todayKey());
      })
      .catch((error: unknown) => {
        // Falhar aqui nunca deve impedir o resto da app de funcionar -
        // fica só sem o prompt até ao próximo carregamento.
        console.error('Failed to load overdue check-ins:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isEnabled]);

  const answer = useCallback(
    async (isCompleted: boolean) => {
      const current = pendingTasks[0];
      if (!current || isAnswering) return;

      setIsAnswering(true);
      try {
        await confirmOverdueTask(current.id, isCompleted);
        setPendingTasks((prev) => prev.slice(1));
      } catch (error: unknown) {
        console.error('Failed to confirm overdue task:', error);
        // Mantemos a task na fila para tentar de novo, em vez de a
        // avançar silenciosamente como se tivesse sido respondida.
      } finally {
        setIsAnswering(false);
      }
    },
    [pendingTasks, isAnswering],
  );

  return {
    pendingTasks,
    currentTask: pendingTasks[0] ?? null,
    isAnswering,
    answer,
  };
}
