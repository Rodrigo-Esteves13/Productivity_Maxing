import { useState, useEffect, useRef, useCallback } from 'react';
import { startStudySession, endStudySession, getActiveStudySession } from '../api/studyService';
import type { StudySession, StudySessionMode } from '../types/models';

export function useStudySession() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  // Terminar é em 2 passos: primeiro só mostra o prompt de rating
  // (isEnding), só chama a API quando o rating é confirmado ou saltado -
  // o backend não deixa terminar a mesma sessão duas vezes, por isso não
  // dá para "terminar" e depois "atualizar com o rating" em 2 pedidos.
  const [isEnding, setIsEnding] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Restaura a sessão em curso ao montar (ex: recarregaste a página a meio
  // de uma sessão) - sem isto, o timer "esquecia-se" sempre que navegavas.
  useEffect(() => {
    (async () => {
      try {
        const session = await getActiveStudySession();
        setActiveSession(session ?? null);
      } catch {
        setActiveSession(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      setElapsedSeconds(0);
      return;
    }
    const startedAtMs = new Date(activeSession.startedAt).getTime();
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [activeSession]);

  const start = useCallback(async (mode: StudySessionMode, taskId?: string) => {
    setIsStarting(true);
    try {
      const session = await startStudySession({ mode, taskId });
      setActiveSession(session);
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Abre o prompt de rating - ainda não termina nada no backend.
  const requestEnd = useCallback(() => setIsEnding(true), []);

  const cancelEnd = useCallback(() => setIsEnding(false), []);

  // Termina de facto, com ou sem rating (undefined = "saltar avaliação").
  const confirmEnd = useCallback(
    async (focusRating?: number) => {
      if (!activeSession) return;
      await endStudySession(activeSession.id, focusRating);
      setActiveSession(null);
      setIsEnding(false);
    },
    [activeSession],
  );

  return {
    activeSession,
    elapsedSeconds,
    isLoading,
    isStarting,
    isEnding,
    start,
    requestEnd,
    cancelEnd,
    confirmEnd,
  };
}
