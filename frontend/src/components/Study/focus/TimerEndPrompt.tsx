import { useEffect, useRef, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useStudyClock } from '../../../context/useStudyClock';
import { useStopSession } from '../../../hooks/useStopSession';
import { notify, playChime } from '../../../lib/focusAlerts';
import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';

// O bloco de foco acabou: aviso (som e notificacao) uma vez por sessao e
// escolha entre pausa, continuar ou parar.
export default function TimerEndPrompt() {
  const { t } = useI18n();
  const { activeSession, timerPlan, isSubmitting, startBreak } = useActiveStudySession();
  const { remainingSeconds } = useStudyClock();
  const { stopSession } = useStopSession();
  const alertedFor = useRef<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const isFinished = Boolean(activeSession && timerPlan && remainingSeconds === 0);
  const sessionId = activeSession?.id ?? null;

  useEffect(() => {
    if (!isFinished || !sessionId || alertedFor.current === sessionId) return;
    alertedFor.current = sessionId;
    playChime();
    notify(t('ui.focusBlockFinished'), t('ui.timeForABreakOr'));
  }, [isFinished, sessionId, t]);

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
    <div role="alertdialog" aria-label={t('ui.focusBlockFinished')} className="rounded-xl border border-violet-600/60 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-medium text-white">{t('ui.minutesDone', { focusMinutes: timerPlan.focusMinutes })}</p>
      <p className="mt-1 text-xs text-neutral-400">{t('ui.goodBlockTakeABreak')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {timerPlan.breakMinutes > 0 && (
          <Button variant="primary" className="px-3 py-1.5 text-sm" disabled={isSubmitting} onClick={() => void takeBreak()}>
            {t('ui.takeAMinBreak', { breakMinutes: timerPlan.breakMinutes })}</Button>
        )}
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setDismissedFor(activeSession.id)}>
          {t('ui.keepGoing')}
        </Button>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" disabled={isSubmitting} onClick={() => void stopSession()}>
          {t('ui.stop')}
        </Button>
      </div>
    </div>
  );
}
