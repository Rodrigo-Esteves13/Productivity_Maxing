import { useCallback } from 'react';
import { syncTaskToCalendar, unsyncTaskFromCalendar } from '../api/calendarService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import type { Task } from '../types/models';

// Aplica o resultado da checkbox "Add to Google Calendar" depois de criar
// ou atualizar uma task. Nunca lança - se a chamada ao Google falhar, a
// task em si já foi guardada com sucesso; falhar aqui só significa que o
// evento não foi criado/removido, e o botão de sync no Dashboard
// (CalendarSyncButton) fica sempre disponível para tentar outra vez.
export function useTaskCalendarSync() {
  const { notify } = useFeedback();

  const applyCalendarSync = useCallback(
    async (task: Task, syncToCalendar: boolean): Promise<Task> => {
      try {
        if (syncToCalendar) {
          const { googleCalendarEventId } = await syncTaskToCalendar(task.id);
          return { ...task, googleCalendarEventId };
        }
        if (task.googleCalendarEventId) {
          await unsyncTaskFromCalendar(task.id);
          return { ...task, googleCalendarEventId: null };
        }
      } catch {
        // A task ficou gravada; avisa que so o Calendar falhou (U-A07).
        notify(translateNow('ux4tasks.calendarSyncFailed', { title: task.title }), 'info');
      }
      return task;
    },
    [notify],
  );

  return { applyCalendarSync };
}
