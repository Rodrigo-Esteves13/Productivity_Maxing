import { useEffect, useRef, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { notify, playChime, requestNotifyPermission } from '../../../lib/focusAlerts';
import { breakRemainingSeconds } from '../../../lib/focusTimer';
import { formatElapsed } from '../../../lib/formatDuration';
import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';
import { fillNodes } from '../../../i18n/fillNodes';

// Pausa entre blocos: contagem decrescente e, no fim, aviso e "comecar o
// proximo bloco" com a mesma task.
export default function BreakBanner() {
  const { t } = useI18n();
  const { restBreak, endBreak, start, isSubmitting } = useActiveStudySession();
  const [now, setNow] = useState(() => Date.now());
  const alertedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!restBreak) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [restBreak]);

  const remaining = restBreak ? breakRemainingSeconds(restBreak, now) : null;
  const endsAt = restBreak?.endsAt ?? null;

  useEffect(() => {
    if (remaining !== 0 || endsAt === null || alertedFor.current === endsAt) return;
    alertedFor.current = endsAt;
    playChime();
    notify(t('ui.breakOver'), t('ui.readyForTheNextBlock'));
  }, [remaining, endsAt, t]);

  if (!restBreak || remaining === null) return null;

  const resume = restBreak.resume;

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-neutral-700 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm">
      {remaining > 0 ? (
        <>
          <p className="text-sm font-medium text-white">
            {fillNodes(t('ui.breakRemaining'), {
              time: <span className="font-mono tabular-nums text-violet-300">{formatElapsed(remaining)}</span>,
            })}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{t('ui.stepAwayFromTheScreen')}</p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={endBreak}>
              {t('ui.skipBreak')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-white">{t('ui.breakOver')}</p>
          <p className="mt-1 text-xs text-neutral-400">{t('ui.readyForTheNextBlock')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume && (
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  void requestNotifyPermission();
                  void start({ taskId: resume.taskId, areaId: resume.areaId }, resume.plan);
                }}
              >
                {t('ui.startNextBlock')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={endBreak}>
              {t('ui.doneForNow')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
