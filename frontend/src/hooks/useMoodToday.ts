import { useCallback, useEffect, useState } from 'react';
import { getMoodLogs, saveMoodLog } from '../api/wellbeingService';
import { useLisbonToday } from './useLisbonToday';
import type { MoodLog, UpsertMoodInput } from '../types/models';

// Registo do humor de hoje: carrega o que ja existe e grava (upsert).
export function useMoodToday() {
  // Dia de Lisboa (o do backend). Muda a meia-noite e ao voltar a app, para
  // nao gravar o humor de hoje por cima do de ontem (D-05).
  const today = useLisbonToday();
  const [log, setLog] = useState<MoodLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Dia novo: o registo de ontem deixa de ser o de hoje.
    setLog(null);
    setIsLoading(true);
    setError(false);
    getMoodLogs(today, today)
      .then((logs) => {
        if (!cancelled) setLog(logs[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const save = useCallback(
    async (input: UpsertMoodInput): Promise<boolean> => {
      setIsSaving(true);
      try {
        setLog(await saveMoodLog(today, input));
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [today],
  );

  return { today, log, isLoading, error, isSaving, save };
}
