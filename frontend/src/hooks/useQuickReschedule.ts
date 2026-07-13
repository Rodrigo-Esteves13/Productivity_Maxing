import { useState, useCallback } from 'react';
import { updateTask } from '../api/userService';
import { syncTaskToCalendar } from '../api/calendarService';
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

        // Bug fix: o reschedule rápido (+1 Day) estava a saltar o passo de
        // sync que o TaskEditForm normal faz (ver applyCalendarSync em
        // useTasksPage.ts) - por isso a task avançava de dia na app mas o
        // evento no Google Calendar ficava parado na data antiga. Se a
        // task já tem um evento ligado, reenviamos o upsert para arrastar
        // a data nova também para o Calendar. Falha silenciosa de
        // propósito, tal como no applyCalendarSync: se o Google falhar, a
        // task em si já foi guardada com sucesso, e o CalendarSyncButton
        // continua disponível para tentar sincronizar outra vez à mão.
        let finalTask = updated;
        if (updated.googleCalendarEventId) {
          try {
            const { googleCalendarEventId } = await syncTaskToCalendar(updated.id);
            finalTask = { ...updated, googleCalendarEventId };
          } catch (syncError: unknown) {
            console.error('Error re-syncing task with Google Calendar:', syncError);
          }
        }

        // Atualiza a UI otimizada através da callback do pai (Dashboard/TasksPage)
        onSuccess(finalTask);
      } catch (error: unknown) {
        console.error('Error rescheduling task:', error);
        // Num cenário ideal, ligarias isto ao teu sistema de Toast notifications
        alert('Could not reschedule the task.');
      } finally {
        setReschedulingId(null);
      }
    },
    [reschedulingId, onSuccess]
  );

  return { rescheduleToTomorrow, reschedulingId };
}