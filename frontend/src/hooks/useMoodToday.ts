import { useCallback, useEffect, useState } from 'react';
import { deleteMoodLog, getMoodLogs, saveMoodLog } from '../api/wellbeingService';
import { toDateKey } from '../lib/dateKey';
import { MS_PER_DAY } from '../lib/timeConstants';
import { useLisbonToday } from './useLisbonToday';
import type { MoodLog, UpsertMoodInput } from '../types/models';

// Ate quantos dias atras se pode registar o humor de um dia que ficou em falta.
export const MOOD_MAX_PAST_DAYS = 90;

// Registo do humor de um dia (hoje por defeito, ou um dia anterior em falta):
// carrega o que ja existe e grava (upsert).
export function useMoodToday() {
  // Dia de Lisboa (o do backend). Muda a meia-noite e ao voltar a app, para
  // nao gravar o humor de hoje por cima do de ontem (D-05).
  const today = useLisbonToday();
  // 0 = hoje, 1 = ontem... Para registar um dia que ficou por registar.
  const [dayOffset, setDayOffset] = useState(0);
  const day = dayOffset === 0 ? today : toDateKey(new Date(Date.parse(today) - dayOffset * MS_PER_DAY));
  // O registo guarda o dia a que pertence: uma resposta que chega depois de
  // mudares de dia nunca aparece no dia errado.
  const [entry, setEntry] = useState<{ day: string; log: MoodLog | null }>({ day, log: null });
  const log = entry.day === day ? entry.log : null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Sobe a cada gravacao ou apagar: os insights recalculam-se so nessa altura.
  const [version, setVersion] = useState(0);
  // Sobe para voltar a carregar o dia atual (botao "Tentar de novo").
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Dia novo: o registo de ontem deixa de ser o de hoje.
    setIsLoading(true);
    setError(false);
    getMoodLogs(day, day)
      .then((logs) => {
        if (!cancelled) setEntry({ day, log: logs[0] ?? null });
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
  }, [day, reloadCount]);

  const save = useCallback(
    async (input: UpsertMoodInput): Promise<boolean> => {
      setIsSaving(true);
      try {
        const saved = await saveMoodLog(day, input);
        setEntry({ day, log: saved });
        setVersion((n) => n + 1);
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [day],
  );

  // Apaga o registo do dia (um registo errado deixa de ficar para sempre).
  const clear = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      await deleteMoodLog(day);
      setEntry({ day, log: null });
      setVersion((n) => n + 1);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [day]);

  return {
    version,
    today,
    day,
    dayOffset,
    setDayOffset: (offset: number) => setDayOffset(Math.min(MOOD_MAX_PAST_DAYS, Math.max(0, offset))),
    log, isLoading, error, isSaving,
    reload: () => setReloadCount((n) => n + 1),
    save,
    clear,
  };
}
