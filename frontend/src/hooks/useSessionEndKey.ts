import { useState } from 'react';
import { useActiveStudySession } from '../context/useActiveStudySession';
import type { DataDomain } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';

const STUDY_DOMAINS: readonly DataDomain[] = ['studySessions'];

// Chave de refetch das estatisticas de estudo: o id da ultima sessao que
// TERMINOU (null ate acabar uma). Ao contrario do id da sessao ativa, nao
// muda ao iniciar uma sessao (nada mudou nas estatisticas), so ao parar.
export function useSessionEndKey(): string | null {
  const { activeSession } = useActiveStudySession();
  const currentId = activeSession?.id ?? null;
  const [previousId, setPreviousId] = useState<string | null>(currentId);
  const [endedId, setEndedId] = useState<string | null>(null);
  if (currentId !== previousId) {
    setPreviousId(currentId);
    if (previousId !== null) setEndedId(previousId);
  }
  return endedId;
}

// Chave de refetch de tudo o que depende das sessoes de estudo: muda quando
// uma sessao termina (useSessionEndKey) e quando outra parte da app cria,
// corrige ou apaga uma sessao, ou usa um dia de descanso (lib/domainEvents).
// `domains`: outros dominios de que os dados tambem dependem (ex: tasks e
// notas para as previsoes). Passar uma constante, nao um array novo.
export function useStudyDataKey(domains: readonly DataDomain[] = STUDY_DOMAINS): string {
  return useDomainKey(domains, useSessionEndKey());
}
