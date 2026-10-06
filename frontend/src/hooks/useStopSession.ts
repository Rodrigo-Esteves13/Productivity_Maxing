import { useCallback } from 'react';
import { useActiveStudySession } from '../context/useActiveStudySession';
import { bulkUpdateTaskStatus } from '../api/userService';
import type { StopStudySessionInput } from '../api/studySessionsService';

// Parar a sessao ativa e, se pedido, marcar a task como concluida. Usado
// pelo widget do Focus, pelo modo foco e pelo aviso de fim de bloco, para
// nenhum deles repetir a logica "parar e depois fechar a task".
export function useStopSession() {
  const { activeSession, stop } = useActiveStudySession();

  const stopSession = useCallback(
    async (options: StopStudySessionInput = {}, markTaskDone = false): Promise<boolean> => {
      const taskId = activeSession?.taskId ?? null;
      const stopped = await stop(options);
      if (!stopped) return false;
      if (markTaskDone && taskId) {
        try {
          await bulkUpdateTaskStatus([taskId], 'COMPLETED');
        } catch {
          // A sessao ja ficou gravada; so a task nao foi marcada. A pessoa
          // pode marca-la nas Tasks, nao vale a pena anular a sessao por isto.
        }
      }
      return true;
    },
    [activeSession, stop],
  );

  return { stopSession };
}
