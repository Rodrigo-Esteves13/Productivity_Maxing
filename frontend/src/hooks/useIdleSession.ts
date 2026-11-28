import { useCallback, useEffect, useState } from 'react';
import { useActiveStudySession } from '../context/useActiveStudySession';
import { isIdle, readLastActivity, touchActivity } from '../lib/idleClock';
import { useVisibleInterval } from './useVisibleInterval';

const CHECK_INTERVAL_MS = 30_000;

// Enquanto ha sessao ativa, deteta que a pessoa deixou de mexer na app (em
// qualquer tab) e devolve o instante da ultima atividade, para perguntar
// "ainda estas a estudar?". Nunca para a sessao sozinho: ler um livro sem
// tocar no ecra e estudar.
export function useIdleSession() {
  const { activeSession } = useActiveStudySession();
  const [idleSince, setIdleSince] = useState<number | null>(null);

  const check = useCallback(() => {
    const last = readLastActivity();
    setIdleSince(last !== null && isIdle(last, Date.now()) ? last : null);
  }, []);

  useVisibleInterval(check, CHECK_INTERVAL_MS, { enabled: Boolean(activeSession) });

  useEffect(() => {
    if (!activeSession) {
      setIdleSince(null);
      return;
    }
    // Ao voltar a esta tab verifica logo, em vez de esperar pelo proximo ciclo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeSession, check]);

  const stillHere = useCallback(() => {
    touchActivity();
    setIdleSince(null);
  }, []);

  return { idleSince, stillHere };
}
