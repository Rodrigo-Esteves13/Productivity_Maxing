import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AmbientSoundContext } from './ambient-sound-context';
import { useAuth } from './useAuth';
import { useActiveStudySession } from './useActiveStudySession';
import { useAmbientSoundPref } from '../hooks/useAmbientSoundPref';
import { createAmbientEngine, type AmbientEngine, type AmbientKind } from '../lib/ambientNoise';
import {
  AMBIENT_IDLE,
  reduceAmbientSession,
  type AmbientSessionEvent,
  type AmbientSessionState,
} from '../lib/ambientSession';

// Montado uma vez (App.tsx, dentro do StudySessionProvider): e dono do motor
// de audio, por isso o som nao morre ao sair da pagina Focus. O AudioContext
// so e criado dentro de play() (um clique) e fecha-se em stop(), ao acabar a
// sessao, ao sair da conta ou ao desmontar. Nunca toca sozinho ao carregar.
export function AmbientSoundProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { activeSession } = useActiveStudySession();
  const { pref, setPref } = useAmbientSoundPref();
  const sessionId = activeSession?.id ?? null;

  const engineRef = useRef<AmbientEngine | null>(null);
  const stateRef = useRef<AmbientSessionState>(AMBIENT_IDLE);
  const [state, setState] = useState<AmbientSessionState>(AMBIENT_IDLE);
  const [failed, setFailed] = useState(false);

  const getEngine = useCallback(() => {
    engineRef.current ??= createAmbientEngine();
    return engineRef.current;
  }, []);

  const apply = useCallback((event: AmbientSessionEvent) => {
    const next = reduceAmbientSession(stateRef.current, event);
    if (next === stateRef.current) return next;
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  // A sessao acabou (ou mudou) / saiu da conta: para o som.
  useEffect(() => {
    const next = apply(isAuthenticated ? { type: 'session', sessionId } : { type: 'signedOut' });
    if (!next.playing) engineRef.current?.stop();
  }, [apply, isAuthenticated, sessionId]);

  useEffect(
    () => () => {
      engineRef.current?.stop();
    },
    [],
  );

  const stop = useCallback(() => {
    engineRef.current?.stop();
    apply({ type: 'stop' });
  }, [apply]);

  const play = useCallback(
    (kind: AmbientKind = pref.kind) => {
      try {
        getEngine().play(kind, pref.volume);
        apply({ type: 'start', sessionId });
        setFailed(false);
      } catch {
        // Browser sem Web Audio (muito antigo) ou bloqueado.
        engineRef.current?.stop();
        apply({ type: 'stop' });
        setFailed(true);
      }
    },
    [apply, getEngine, pref.kind, pref.volume, sessionId],
  );

  const toggle = useCallback(() => {
    if (stateRef.current.playing) stop();
    else play();
  }, [play, stop]);

  const setKind = useCallback(
    (kind: AmbientKind) => {
      setPref({ ...pref, kind });
      if (stateRef.current.playing) play(kind);
    },
    [pref, play, setPref],
  );

  const setVolume = useCallback(
    (volume: number) => {
      setPref({ ...pref, volume });
      engineRef.current?.setVolume(volume);
    },
    [pref, setPref],
  );

  const value = useMemo(
    () => ({
      kind: pref.kind,
      volume: pref.volume,
      isPlaying: state.playing,
      failed,
      play,
      stop,
      toggle,
      setKind,
      setVolume,
    }),
    [pref.kind, pref.volume, state.playing, failed, play, stop, toggle, setKind, setVolume],
  );

  return <AmbientSoundContext.Provider value={value}>{children}</AmbientSoundContext.Provider>;
}
