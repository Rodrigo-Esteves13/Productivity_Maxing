import { useCallback, useEffect, useRef, useState } from 'react';
import { previewScheduleSync, syncSchedule } from '../api/calendarService';
import type { SchedulePreview, ScheduleSyncResult } from '../api/calendarService';
import { subscribeToCalendarSyncReview } from '../lib/calendarSyncEvents';
import { useCalendarStatus } from './useCalendarStatus';

type ReviewPhase = 'closed' | 'review' | 'syncing' | 'done' | 'error';

// Várias alterações seguidas (ex: criar um local e logo a seguir 3 turnos)
// pedem um único modal, calculado sobre o estado final.
const DEBOUNCE_MS = 700;

export function useCalendarSyncReview() {
  const connected = useCalendarStatus();
  const [phase, setPhase] = useState<ReviewPhase>('closed');
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [result, setResult] = useState<ScheduleSyncResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Se o modal já está aberto, novos pedidos não o devem fechar nem trocar
  // o que a pessoa está a ler.
  const phaseRef = useRef<ReviewPhase>('closed');
  phaseRef.current = phase;

  const openReview = useCallback(async (force: boolean) => {
    if (phaseRef.current !== 'closed') return;
    try {
      const next = await previewScheduleSync();
      const hasChanges = next.create + next.update + next.remove > 0;
      if (!hasChanges && !force) return;
      setPreview(next);
      setResult(null);
      setPhase('review');
    } catch {
      // Falhar em silêncio quando foi automático (não há nada de útil a
      // dizer a quem só mudou um turno); só o botão manual mostra erro.
      if (force) setPhase('error');
    }
  }, []);

  useEffect(() => {
    // Sem Google Calendar ligado não há nada a rever.
    if (!connected) return;

    const unsubscribe = subscribeToCalendarSyncReview(({ force }) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void openReview(force), DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, [connected, openReview]);

  const confirm = useCallback(async () => {
    try {
      setPhase('syncing');
      setResult(await syncSchedule());
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }, []);

  // "Deny": fecha sem escrever nada no calendário.
  const deny = useCallback(() => {
    setPhase('closed');
    setPreview(null);
  }, []);

  return { phase, preview, result, confirm, deny };
}
