import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getActiveStudySession,
  startStudySession,
  stopStudySession,
  heartbeatStudySession,
  type StartStudySessionInput,
  type StopStudySessionInput,
} from '../api/studySessionsService';
import type { StudySession } from '../types/models';
import { useAuth } from './useAuth';
import { StudyClockContext, StudySessionContext } from './study-session-context';
import { getApiMessage, getHttpStatus, HTTP_CONFLICT } from '../lib/httpError';
import { announceSessionChanged, onSessionChangedElsewhere } from '../lib/focusChannel';
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
import { translateNow } from '../i18n/translate';
import { useFeedback } from './useFeedback';

const HTTP_NOT_FOUND = 404;
// Ao parar: a sessao ja nao existe ou ja foi parada (auto-close, outra tab
// ou outro dispositivo). O ecra ressincroniza em vez de ficar parado.
const STALE_STOP_STATUSES = new Set([HTTP_NOT_FOUND, HTTP_CONFLICT]);

// Fim do bloco de foco planeado (ISO), para o heartbeat: enquanto estiver
// dentro dele o servidor nao fecha a sessao por falta de contacto.
function plannedEndOf(session: StudySession | null, plan: TimerPlan | null): string | undefined {
  if (!session || !plan) return undefined;
  return new Date(new Date(session.startedAt).getTime() + plan.focusMinutes * 60_000).toISOString();
}

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
  const { notify } = useFeedback();

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timerPlan, setTimerPlan] = useState<TimerPlan | null>(null);
  const [restBreak, setRestBreak] = useState<RestBreak | null>(() => loadBreak());
  const [justStopped, setJustStopped] = useState<StudySession | null>(null);

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
  const timerPlanRef = useRef<TimerPlan | null>(null);
  useEffect(() => {
    timerPlanRef.current = timerPlan;
  }, [timerPlan]);

  const fetchActive = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const session = await getActiveStudySession();
      setActiveSession(session);
    } catch {
      setError(translateNow('hook.couldNotLoadTheStudySession'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Volta a perguntar ao servidor qual e a sessao ativa, SEM mostrar
  // "a carregar" nem erro: usado para as tabs concordarem entre si.
  // `notifyIfEnded`: se a sessao que este ecra mostrava desapareceu sem a
  // pessoa a parar aqui (fechada por falta de contacto, ou noutro
  // dispositivo), diz-se isso num toast em vez de o cronometro sumir.
  const syncActive = useCallback(
    async (notifyIfEnded = false) => {
      const previous = activeSessionRef.current;
      try {
        const current = await getActiveStudySession();
        if (previous && previous.id !== current?.id) {
          clearPlan(previous.id);
          if (notifyIfEnded) notify(translateNow('ui.sessionEndedElsewhere'), 'info');
        }
        setActiveSession(current);
      } catch {
        // Falhou um sync em segundo plano: fica o estado que ja temos.
      }
    },
    [notify],
  );

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
    // Ao voltar (ex: telemovel desbloqueado), primeiro um heartbeat com o fim
    // do bloco planeado e so depois o sync: se o GET /active chegasse antes,
    // o servidor fechava como "esquecida" uma sessao ainda dentro do bloco.
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const session = activeSessionRef.current;
      if (!session) {
        void syncActive(true);
        return;
      }
      void heartbeatStudySession(session.id, plannedEndOf(session, timerPlanRef.current))
        .catch(() => undefined)
        .finally(() => void syncActive(true));
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
      const plannedEndAt = plannedEndOf(activeSessionRef.current, timerPlanRef.current);
      void heartbeatStudySession(sessionId, plannedEndAt).catch((error: unknown) => {
        // Best-effort - a missed beat or two doesn't matter, see
        // STALE_SESSION_THRESHOLD_MS on the backend. A 404 e diferente:
        // a sessao ja nao esta ativa no servidor (parada noutra tab ou
        // fechada por inatividade), por isso corrige-se o ecra em vez de
        // continuar a mostrar um cronometro de uma sessao que ja acabou.
        if (getHttpStatus(error) === HTTP_NOT_FOUND) void syncActive(true);
      });
    };
    heartbeatRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [activeSession, syncActive]);

  // Sem stop no `pagehide`: disparava tambem no F5, no reload automatico do
  // service worker depois de um deploy e ao seguir o link "Ligar Google
  // Calendar", e parava a sessao em curso sem aviso. Uma tab fechada de
  // vez fica sem heartbeat e o servidor fecha a sessao no ultimo contacto
  // (StudySessionsService.autoCloseIfStale), com precisao de ~1 minuto.

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
      } catch (err) {
        // Toast tambem: o erro inline so aparece no widget da pagina Focus,
        // e o pill global / prompt de fim de bloco / pausa ficavam calados.
        const message = getApiMessage(err, translateNow('ui.couldNotStartSession'));
        setError(message);
        notify(message, 'error');
        if (getHttpStatus(err) === HTTP_CONFLICT) void syncActive();
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [notify, syncActive],
  );

  const stop = useCallback(
    async (options: StopStudySessionInput = {}, skipFocusPrompt = false) => {
      if (!activeSession) return false;
      try {
        setIsSubmitting(true);
        setError('');
        const stopped = await stopStudySession(activeSession.id, options);
        clearPlan(activeSession.id);
        setJustStopped(!skipFocusPrompt && stopped.focusRating === null ? stopped : null);
        setActiveSession(null);
        announceSessionChanged();
        return true;
      } catch (err) {
        const message = getApiMessage(err, translateNow('ui.couldNotStopSession'));
        setError(message);
        notify(message, 'error');
        if (STALE_STOP_STATUSES.has(getHttpStatus(err) ?? 0)) void syncActive();
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeSession, notify, syncActive],
  );

  const dismissJustStopped = useCallback(() => setJustStopped(null), []);
  const setDistractionCount = useCallback((count: number) => {
    setActiveSession((current) => (current ? { ...current, distractionCount: count } : current));
  }, []);

  const startBreak = useCallback((minutes: number, resume: ResumeSpec | null) => {
    const rest: RestBreak = { endsAt: Date.now() + minutes * 60_000, resume };
    saveBreak(rest);
    setRestBreak(rest);
  }, []);

  const endBreak = useCallback(() => {
    clearBreak();
    setRestBreak(null);
  }, []);

  // Valor memorizado: so muda quando o estado da sessao muda, nao a cada
  // tick. O relogio vai num contexto proprio (ver study-session-context).
  const sessionValue = useMemo(
    () => ({
      activeSession,
      isLoading,
      isSubmitting,
      error,
      start,
      stop,
      timerPlan,
      restBreak,
      startBreak,
      endBreak,
      justStopped,
      dismissJustStopped,
      setDistractionCount,
    }),
    [activeSession, isLoading, isSubmitting, error, start, stop, timerPlan, restBreak, startBreak, endBreak, justStopped, dismissJustStopped, setDistractionCount],
  );
  const clockValue = useMemo(
    () => ({ elapsedSeconds, remainingSeconds: computeRemaining(elapsedSeconds, timerPlan) }),
    [elapsedSeconds, timerPlan],
  );

  return (
    <StudySessionContext.Provider value={sessionValue}>
      <StudyClockContext.Provider value={clockValue}>{children}</StudyClockContext.Provider>
    </StudySessionContext.Provider>
  );
}
