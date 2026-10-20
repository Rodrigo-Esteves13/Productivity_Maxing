import { useEffect, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useStopSession } from '../../../hooks/useStopSession';
import SessionClock, { BlockFinishedSwitch } from './SessionClock';
import { exitFullscreen } from '../../../lib/fullscreen';
import Button from '../../UI/Button';
import StopSessionPanel from './StopSessionPanel';
import OpenNotesLink from './OpenNotesLink';
import { useI18n } from '../../../i18n/useI18n';

interface FocusModeOverlayProps {
  onClose: () => void;
}

// Ecra limpo so com o tempo e a task, por cima de tudo. Esc sai.
export default function FocusModeOverlay({ onClose }: FocusModeOverlayProps) {
  const { t } = useI18n();
  const { activeSession, isSubmitting, timerPlan } = useActiveStudySession();
  const { stopSession } = useStopSession();
  const [isStopping, setIsStopping] = useState(false);

  const close = () => {
    exitFullscreen();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFullscreen();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Se a sessao acabar (parada aqui ou noutra tab), o modo foco fecha-se.
  useEffect(() => {
    if (!activeSession) {
      exitFullscreen();
      onClose();
    }
  }, [activeSession, onClose]);

  if (!activeSession) return null;

  const label = activeSession.task?.title ?? activeSession.area?.name ?? t('ui.focusSession');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.focusMode')}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-neutral-950 px-6 text-center"
    >
      <p className="mb-2 max-w-xl truncate text-lg text-neutral-400">{label}</p>
      <p className="font-mono text-6xl font-bold tabular-nums text-violet-400 sm:text-8xl">
        <SessionClock />
      </p>
      <p className="mt-3 text-sm text-neutral-500">
        {timerPlan === null ? (
          t('ui.countingUp')
        ) : (
          <BlockFinishedSwitch running={t('ui.remainingInThisBlock')} finished={t('ui.timeIsUpKeepGoing')} />
        )}
      </p>
      <div className="mt-3">
        <OpenNotesLink areaId={activeSession.areaId} />
      </div>

      <div className="mt-10 w-full max-w-sm">
        {isStopping ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left">
            <StopSessionPanel
              taskTitle={activeSession.task?.title ?? null}
              isSubmitting={isSubmitting}
              onCancel={() => setIsStopping(false)}
              onConfirm={async ({ markTaskDone, ...options }) => {
                if (await stopSession(options, markTaskDone, true)) close();
              }}
            />
          </div>
        ) : (
          <div className="flex justify-center gap-3">
            <Button variant="primary" onClick={() => setIsStopping(true)}>
              {t('ui.stopSession')}
            </Button>
            <Button variant="secondary" onClick={close}>
              {t('ui.exitFocusModeEsc')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
