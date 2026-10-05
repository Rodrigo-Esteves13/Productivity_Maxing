import { useEffect, useRef, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useStopSession } from '../../../hooks/useStopSession';
import { notify, playChime } from '../../../lib/focusAlerts';
import Button from '../../UI/Button';

// O bloco de foco acabou: aviso (som e notificacao) uma vez por sessao e
// escolha entre pausa, continuar ou parar.
export default function TimerEndPrompt() {
  const { activeSession, timerPlan, remainingSeconds, isSubmitting, startBreak } = useActiveStudySession();
  const { stopSession } = useStopSession();
  const alertedFor = useRef<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const isFinished = Boolean(activeSession && timerPlan && remainingSeconds === 0);
  const sessionId = activeSession?.id ?? null;

  useEffect(() => {
    if (!isFinished || !sessionId || alertedFor.current === sessionId) return;
    alertedFor.current = sessionId;
    playChime();
    notify('Focus block finished', 'Time for a break, or keep going if you are in the flow.');
  }, [isFinished, sessionId]);

  if (!activeSession || !timerPlan || !isFinished || dismissedFor === activeSession.id) return null;

  const takeBreak = async () => {
    const resume = {
      taskId: activeSession.taskId ?? undefined,
      areaId: activeSession.areaId ?? undefined,
      plan: timerPlan,
    };
    if (await stopSession()) startBreak(timerPlan.breakMinutes, resume);
  };

  return (
    <div role="alertdialog" aria-label="Focus block finished" className="rounded-xl border border-violet-600/60 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-medium text-white">{timerPlan.focusMinutes} minutes done</p>
      <p className="mt-1 text-xs text-neutral-400">Good block. Take a break, or keep going while you are in the flow.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {timerPlan.breakMinutes > 0 && (
          <Button variant="primary" className="px-3 py-1.5 text-sm" disabled={isSubmitting} onClick={() => void takeBreak()}>
            Take a {timerPlan.breakMinutes} min break
          </Button>
        )}
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setDismissedFor(activeSession.id)}>
          Keep going
        </Button>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" disabled={isSubmitting} onClick={() => void stopSession()}>
          Stop
        </Button>
      </div>
    </div>
  );
}
