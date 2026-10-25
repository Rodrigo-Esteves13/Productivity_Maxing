import { useCallback } from 'react';
import { useActiveStudySession } from '../context/useActiveStudySession';
import { bulkUpdateTaskStatus } from '../api/userService';
import type { StopStudySessionInput } from '../api/studySessionsService';
import { celebrateCompletion } from '../lib/completionFeedback';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

// Parar a sessao ativa e, se pedido, marcar a task como concluida. Usado
// pelo widget do Focus, pelo modo foco e pelo aviso de fim de bloco, para
// nenhum deles repetir a logica "parar e depois fechar a task".
export function useStopSession() {
  const { activeSession, stop } = useActiveStudySession();
  const { notify } = useFeedback();

  const stopSession = useCallback(
    async (options: StopStudySessionInput = {}, markTaskDone = false, skipFocusPrompt = false): Promise<boolean> => {
      const taskId = activeSession?.taskId ?? null;
      const stopped = await stop(options, skipFocusPrompt);
      if (!stopped) return false;
      if (markTaskDone && taskId) {
        try {
          await bulkUpdateTaskStatus([taskId], 'COMPLETED');
          celebrateCompletion();
        } catch {
          // A sessao ja ficou gravada; so a task nao foi marcada. A pessoa
          // pode marca-la nas Tasks, nao vale a pena anular a sessao por isto,
          // mas tem de saber que a task ficou aberta.
          notify(translateNow('ui.couldNotMarkTaskDone'), 'error');
        }
      }
      return true;
    },
    [activeSession, stop, notify],
  );

  return { stopSession };
}
