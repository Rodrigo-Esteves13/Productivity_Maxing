import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useActiveStudySession } from '../../context/useActiveStudySession';
import { formatElapsed } from '../../lib/formatDuration';
import { ClockIcon, XIcon } from '../UI/Icons';
import BreakBanner from './focus/BreakBanner';
import IdleSessionPrompt from './focus/IdleSessionPrompt';
import TimerEndPrompt from './focus/TimerEndPrompt';

// Mounted once, app-wide (see AppRouter.tsx, next to CommandPalette) - not
// just on the Focus page. That's the actual point of this component: a
// session started on Focus and then forgotten while browsing Tasks or the
// Dashboard should still be obviously running, with a one-click way to
// stop it from wherever Rodrigo notices, instead of having to navigate
// back to Focus first. Tambem aloja os avisos que tem de aparecer em
// qualquer pagina: inatividade, fim de bloco e pausa.
export default function GlobalStudyTimer() {
  const { isAuthenticated } = useAuth();
  const { activeSession, elapsedSeconds, remainingSeconds, isSubmitting, stop } = useActiveStudySession();
  const [isStopping, setIsStopping] = useState(false);

  if (!isAuthenticated) return null;

  const label = activeSession?.task?.title ?? activeSession?.area?.name ?? 'Focus session';

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stop();
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <>
      <div className="print-hide fixed bottom-24 left-6 z-50 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3">
        <IdleSessionPrompt />
        <TimerEndPrompt />
        <BreakBanner />
      </div>

      {activeSession && (
        <div
          role="status"
          aria-live="polite"
          className="print-hide fixed bottom-6 left-6 z-40 flex items-center gap-3 rounded-full border border-violet-500/60 bg-neutral-900/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur-sm"
        >
          <ClockIcon className="h-4 w-4 shrink-0 text-violet-400" />
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-sm font-semibold text-violet-400 tabular-nums">
              {formatElapsed(remainingSeconds ?? elapsedSeconds)}
            </span>
            <span className="max-w-[10rem] truncate text-xs text-neutral-400">
              {remainingSeconds === null ? label : `${label} (left)`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={isSubmitting || isStopping}
            aria-label="Stop focus session"
            title="Stop focus session"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 transition-colors hover:bg-red-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
