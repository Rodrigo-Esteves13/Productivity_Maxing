import { useEffect, useRef, useState } from 'react';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { notify, playChime, requestNotifyPermission } from '../../../lib/focusAlerts';
import { breakRemainingSeconds } from '../../../lib/focusTimer';
import { formatElapsed } from '../../../lib/formatDuration';
import Button from '../../UI/Button';

// Pausa entre blocos: contagem decrescente e, no fim, aviso e "comecar o
// proximo bloco" com a mesma task.
export default function BreakBanner() {
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
    notify('Break over', 'Ready for the next block?');
  }, [remaining, endsAt]);

  if (!restBreak || remaining === null) return null;

  const resume = restBreak.resume;

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-neutral-700 bg-neutral-900/95 p-4 shadow-lg backdrop-blur-sm">
      {remaining > 0 ? (
        <>
          <p className="text-sm font-medium text-white">
            Break <span className="font-mono tabular-nums text-violet-300">{formatElapsed(remaining)}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-400">Step away from the screen.</p>
          <div className="mt-3">
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={endBreak}>
              Skip break
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-white">Break over</p>
          <p className="mt-1 text-xs text-neutral-400">Ready for the next block?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume && (
              <Button
                variant="primary"
                className="px-3 py-1.5 text-sm"
                disabled={isSubmitting}
                onClick={() => {
                  requestNotifyPermission();
                  void start({ taskId: resume.taskId, areaId: resume.areaId }, resume.plan);
                }}
              >
                Start next block
              </Button>
            )}
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={endBreak}>
              Done for now
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
