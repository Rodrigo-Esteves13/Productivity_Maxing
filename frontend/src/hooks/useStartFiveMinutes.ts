import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveStudySession } from '../context/useActiveStudySession';
import { MIN_FOCUS_MINUTES, type TimerPlan } from '../lib/focusTimer';
import { requestNotifyPermission } from '../lib/focusAlerts';
import type { Task } from '../types/models';

// "So 5 minutos": um bloco curto de Focus ligado a task, contra o bloqueio
// de arranque. No fim o aviso de bloco oferece continuar.
const FIVE_MINUTE_PLAN: TimerPlan = { focusMinutes: MIN_FOCUS_MINUTES, breakMinutes: 0 };
const FOCUS_PATH = '/focus';

export function useStartFiveMinutes() {
  const { activeSession, isSubmitting, start } = useActiveStudySession();
  const navigate = useNavigate();

  const startFiveMinutes = useCallback(
    async (task: Task) => {
      // Pedido dentro do clique: e quando o browser deixa.
      void requestNotifyPermission();
      const ok = await start({ taskId: task.id, areaId: task.areaId ?? undefined }, FIVE_MINUTE_PLAN);
      if (ok) navigate(FOCUS_PATH);
    },
    [start, navigate],
  );

  return { startFiveMinutes, canStart: !activeSession && !isSubmitting, minutes: MIN_FOCUS_MINUTES };
}
