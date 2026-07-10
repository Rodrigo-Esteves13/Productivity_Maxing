import { useState, useCallback } from 'react';
import { updateTask } from '../api/userService';
import type { Task } from '../types/models';

interface UseQuickRescheduleReturn {
  reschedulingId: string | null;
  rescheduleToTomorrow: (e: React.MouseEvent, task: Task) => Promise<void>;
}

export function useQuickReschedule(
  onSuccess: (updatedTask: Task) => void
): UseQuickRescheduleReturn {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const rescheduleToTomorrow = useCallback(
    async (e: React.MouseEvent, task: Task) => {
      // Segurança UI: Impede que clicar no botão acione o "abrir modal" da linha inteira
      e.stopPropagation();

      if (reschedulingId) return; // Previne duplo clique

      setReschedulingId(task.id);
      
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Limpa as horas para alinhar com o formato YYYY-MM-DD

        // Usa o endpoint PATCH que já validaste ser seguro contra IDOR
        const updated = await updateTask(task.id, { date: tomorrow.toISOString() });
        
        // Atualiza a UI otimizada através da callback do pai (Dashboard/TasksPage)
        onSuccess(updated);
      } catch (error: unknown) {
        console.error('Erro ao reagendar tarefa:', error);
        // Num cenário ideal, ligarias isto ao teu sistema de Toast notifications
        alert('Não foi possível reagendar a tarefa.');
      } finally {
        setReschedulingId(null);
      }
    },
    [reschedulingId, onSuccess]
  );

  return { rescheduleToTomorrow, reschedulingId };
}