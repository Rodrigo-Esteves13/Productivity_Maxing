import { useState, useCallback } from 'react';
import { updateTask } from '../api/userService';
import { syncTaskToCalendar } from '../api/calendarService';
import type { Task } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { tomorrowForTask } from '../lib/weekDates';

interface UseQuickRescheduleReturn {
  reschedulingId: string | null;
  rescheduleToTomorrow: (e: React.MouseEvent | null, task: Task) => Promise<void>;
}

export function useQuickReschedule(
  onSuccess: (updatedTask: Task) => void
): UseQuickRescheduleReturn {
  const { notify } = useFeedback();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const rescheduleToTomorrow = useCallback(
    async (e: React.MouseEvent | null, task: Task) => {
      // Segurança UI: Impede que clicar no botão acione o "abrir modal" da linha inteira
      // (null = veio de um swipe no cartão, não de um clique).
      e?.stopPropagation();

      if (reschedulingId) return; // Previne duplo clique

      setReschedulingId(task.id);
      
      try {
        // Sem hora continua sem hora (meia-noite UTC), com hora mantem a hora (B-09).
        const tomorrow = tomorrowForTask(new Date(task.date));

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
        notify(translateNow('hook.couldNotRescheduleTheTask'), 'error');
      } finally {
        setReschedulingId(null);
      }
    },
    [reschedulingId, onSuccess, notify]
  );

  return { rescheduleToTomorrow, reschedulingId };
}