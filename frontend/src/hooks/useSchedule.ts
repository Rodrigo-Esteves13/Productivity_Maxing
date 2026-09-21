import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSchedule } from '../api/scheduleService';
import type { ClassOccurrence } from '../types/models';

// BUG HISTÓRICO (Set/2026): esta função e toDateKey() costumavam misturar
// aritmética de datas em hora local (getDay/setDate/setHours) com
// serialização em UTC (toISOString) - em Portugal, que está a UTC+1 no
// horário de verão, meia-noite local é 23:00 UTC do dia ANTERIOR, por
// isso toDateKey(startOfWeek(hoje)) dava sempre o dia de ontem. Isso
// desalinhava a semana toda em um dia (todas as aulas apareciam sob a
// coluna errada). Correção: construir e mexer nas datas sempre em UTC
// (Date.UTC/getUTCDay/setUTCDate), nunca com os equivalentes locais -
// mesma convenção já usada em getLisbonNow() no StudyPlanService (backend)
// e em formatDayLabel() no StudyPlanCard (frontend).
function todayUtcAnchored(): Date {
  const now = new Date();
  // Lê o dia local (o que o utilizador vê no relógio dele) UMA vez com
  // getters locais - é a única leitura local permitida, é para saber
  // "que dia é hoje para esta pessoa". A partir daqui, tudo em UTC.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function startOfWeek(date: Date): Date {
  // Semana começa à segunda-feira - getUTCDay() é 0=Dom..6=Sáb, por isso
  // um domingo (0) fica a 6 dias da última segunda, não a 0.
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Fetches one week of ClassOccurrence at a time, com navegação
// anterior/seguinte - mesma ideia do PeriodSelector para navegar entre
// dashboards, aqui aplicada a semanas do horário.
export function useSchedule(initialWeekStart: Date = todayUtcAnchored()) {
  const [weekStart, setWeekStart] = useState(startOfWeek(initialWeekStart));
  const [occurrences, setOccurrences] = useState<ClassOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setUTCDate(end.getUTCDate() + 6);
    return end;
  }, [weekStart]);

  const fetchWeek = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getSchedule(toDateKey(weekStart), toDateKey(weekEnd));
      setOccurrences(data);
    } catch {
      setError('Could not load the schedule.');
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void fetchWeek();
  }, [fetchWeek]);

  const goToPreviousWeek = () => {
    const prev = new Date(weekStart);
    prev.setUTCDate(prev.getUTCDate() - 7);
    setWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setUTCDate(next.getUTCDate() + 7);
    setWeekStart(next);
  };

  const goToCurrentWeek = () => setWeekStart(startOfWeek(todayUtcAnchored()));

  return {
    weekStart,
    weekEnd,
    occurrences,
    isLoading,
    error,
    refetch: fetchWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
  };
}
