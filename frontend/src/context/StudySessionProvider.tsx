import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getActiveStudySession,
  startStudySession,
  stopStudySession,
  stopStudySessionOnUnload,
  heartbeatStudySession,
  type StartStudySessionInput,
  type StopStudySessionInput,
} from '../api/studySessionsService';
import type { StudySession } from '../types/models';
import { useAuth } from './useAuth';
import { StudySessionContext } from './study-session-context';
import { getHttpStatus } from '../lib/httpError';
import { announceSessionChanged, onSessionChangedElsewhere } from '../lib/focusChannel';
import { isAnotherTabOpen, registerTab } from '../lib/tabPresence';
import { startActivityTracking } from '../lib/idleClock';
import {
  clearBreak,
  clearPlan,
  loadBreak,
  loadPlan,
  remainingSeconds as computeRemaining,
  saveBreak,
  savePlan,
  type ResumeSpec,
  type RestBreak,
  type TimerPlan,
} from '../lib/focusTimer';

const HTTP_NOT_FOUND = 404;

// How often we tell the backend "still here" while a session is running.
// Kept well under StudySessionsService's STALE_SESSION_THRESHOLD_MS
// (10 minutes server-side) so a couple of missed beats - a throttled
// background tab, a brief network blip - never falsely auto-closes a
// session that's genuinely still running.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

// Lifted out of useStudySession.ts (Focus page) so the active session,
// its elapsed timer, start() and stop() are shared app-wide - GlobalStudyTimer
// (visible on every page) and the Focus page's full widget now read the
// exact same state instead of two independent pollers that could drift
// out of sync with each other.
export function StudySessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timerPlan, setTimerPlan] = useState<TimerPlan | null>(null);
  const [restBreak, setRestBreak] = useState<RestBreak | null>(() => loadBreak());

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The pagehide listener below is registered once on mount, so a plain
  // closure over `activeSession` would only ever see the value from the
  // render that registered it - a ref kept in sync gives it the latest
  // session instead.
  const activeSessionRef = useRef<StudySession | null>(null);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const fetchActive = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const session = await getActiveStudySession();
      setActiveSession(session);
    } catch {
      setError('Could not load the study session.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Volta a perguntar ao servidor qual e a sessao ativa, SEM mostrar
  // "a carregar" nem erro: usado para as tabs concordarem entre si.
  const syncActive = useCallback(async () => {
    try {
      setActiveSession(await getActiveStudySession());
    } catch {
      // Falhou um sync em segundo plano: fica o estado que ja temos.
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveSession(null);
      setIsLoading(false);
      return;
    }
    void fetchActive();
  }, [isAuthenticated, fetchActive]);

  // Varias tabs abertas: quando outra comeca ou para a sessao, esta
  // atualiza-se logo; e ao voltar a esta tab (vinda de outra) volta a
  // perguntar ao servidor. Sem isto, uma tab antiga continuava a mostrar
  // uma sessao que a outra ja tinha parado (ou nao via a que a outra comecou).
  useEffect(() => {
    if (!isAuthenticated) return;
    const stopListening = onSessionChangedElsewhere(() => void syncActive());
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void syncActive();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      stopListening();
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [isAuthenticated, syncActive]);

  // O plano de contagem decrescente vive no browser, por sessao: ao mudar
  // de sessao (ou de tab, ou recarregar) volta a ser lido de la.
  useEffect(() => {
    setTimerPlan(activeSession ? loadPlan(activeSession.id) : null);
  }, [activeSession]);

  // Atividade da pessoa (para o aviso "ainda estas a estudar?"): so enquanto ha sessao.
  useEffect(() => {
    if (!isAuthenticated || !activeSession) return;
    return startActivityTracking();
  }, [isAuthenticated, activeSession]);

  // Regista esta tab para as outras saberem que existe (ver pagehide abaixo).
  useEffect(() => {
    if (!isAuthenticated) return;
    return registerTab();
  }, [isAuthenticated]);

  // Local timer - recalculated from startedAt on every tick (not a naive
  // increment), so it doesn't drift if the tab sits in the background and
  // the browser throttles setInterval. Same approach the Focus page's own
  // hook used before this state moved here.
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const startedAtMs = new Date(activeSession.startedAt).getTime();
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    };
    updateElapsed();
    tickRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeSession]);

  // Heartbeat - tells the backend this session is still genuinely open.
  // See StudySessionsService.autoCloseIfStale: without this, a session
  // left running with the laptop closed or the browser killed outright
  // would sit "active" until Rodrigo happens to look again, which was the
  // whole original complaint.
  useEffect(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (!activeSession) return;

    const sessionId = activeSession.id;
    const ping = () => {
      void heartbeatStudySession(sessionId).catch((error: unknown) => {
        // Best-effort - a missed beat or two doesn't matter, see
        // STALE_SESSION_THRESHOLD_MS on the backend. A 404 e diferente:
        // a sessao ja nao esta ativa no servidor (parada noutra tab ou
        // fechada por inatividade), por isso corrige-se o ecra em vez de
        // continuar a mostrar um cronometro de uma sessao que ja acabou.
        if (getHttpStatus(error) === HTTP_NOT_FOUND) void syncActive();
      });
    };
    heartbeatRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [activeSession, syncActive]);

  // Best-effort clean stop when the tab actually closes or navigates away
  // with a session still running. `pagehide` (not `beforeunload`/`unload`,
  // both effectively deprecated for this) is the current recommendation
  // for "the user is truly leaving" - it also reliably fires on tab
  // close, unlike `visibilitychange`, which would also fire on every
  // ordinary tab switch and wrongly stop the session then.
  useEffect(() => {
    const handlePageHide = () => {
      const session = activeSessionRef.current;
      // So pára a sessão se esta for a ÚLTIMA tab aberta. Com outra tab
      // aberta a sessão continua a ser dela (mantém o heartbeat), e fechar
      // uma tab duplicada não pode parar a sessão da outra.
      if (session && !isAnotherTabOpen()) {
        stopStudySessionOnUnload(session.id);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  const start = useCallback(
    async (input: StartStudySessionInput, plan: TimerPlan | null = null) => {
      try {
        setIsSubmitting(true);
        setError('');
        const session = await startStudySession(input);
        if (plan) savePlan(session.id, plan);
        // Comecar um bloco novo termina a pausa (se havia uma).
        clearBreak();
        setRestBreak(null);
        setActiveSession(session);
        announceSessionChanged();
        return true;
      } catch {
        setError('Could not start the session. Please try again.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const stop = useCallback(
    async (options: StopStudySessionInput = {}) => {
      if (!activeSession) return false;
      try {
        setIsSubmitting(true);
        setError('');
        await stopStudySession(activeSession.id, options);
        clearPlan(activeSession.id);
        setActiveSession(null);
        announceSessionChanged();
        return true;
      } catch {
        setError('Could not stop the session. Please try again.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeSession],
  );

  const startBreak = useCallback((minutes: number, resume: ResumeSpec | null) => {
    const rest: RestBreak = { endsAt: Date.now() + minutes * 60_000, resume };
    saveBreak(rest);
    setRestBreak(rest);
  }, []);

  const endBreak = useCallback(() => {
    clearBreak();
    setRestBreak(null);
  }, []);

  return (
    <StudySessionContext.Provider
      value={{
        activeSession,
        elapsedSeconds,
        isLoading,
        isSubmitting,
        error,
        start,
        stop,
        timerPlan,
        remainingSeconds: computeRemaining(elapsedSeconds, timerPlan),
        restBreak,
        startBreak,
        endBreak,
      }}
    >
      {children}
    </StudySessionContext.Provider>
  );
}
