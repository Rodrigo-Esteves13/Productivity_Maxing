import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getActiveStudySession,
  startStudySession,
  stopStudySession,
  type StartStudySessionInput,
} from '../api/studySessionsService';
import { getUserAreas } from '../api/userService';
import type { StudySession, Area } from '../types/models';

export function useStudySession() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const [session, areasData] = await Promise.all([
        getActiveStudySession(),
        getUserAreas(),
      ]);
      setActiveSession(session);
      setAreas(areasData);
    } catch {
      setError('Could not load the study session.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  // Timer local (não depende do backend a cada segundo) - recalcula sempre
  // a partir de startedAt, para não desviar se o separador ficar em
  // background e o setInterval atrasar.
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

  const start = useCallback(async (input: StartStudySessionInput) => {
    try {
      setIsSubmitting(true);
      setError('');
      const session = await startStudySession(input);
      setActiveSession(session);
    } catch {
      setError('Could not start the session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const stop = useCallback(
    async (note?: string) => {
      if (!activeSession) return;
      try {
        setIsSubmitting(true);
        setError('');
        await stopStudySession(activeSession.id, { note });
        setActiveSession(null);
      } catch {
        setError('Could not stop the session. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeSession],
  );

  return {
    activeSession,
    areas,
    elapsedSeconds,
    isLoading,
    isSubmitting,
    error,
    start,
    stop,
  };
}
