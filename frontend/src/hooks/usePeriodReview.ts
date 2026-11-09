import { useCallback, useMemo } from 'react';
import { getUserTasks } from '../api/userService';
import { getSessionHistory } from '../api/studySessionsService';
import { buildPeriodReview, historyDaysForPeriod } from '../lib/periodReview';
import type { PeriodReportCard, StudySession, Task } from '../types/models';
import { useLoadOnce } from './useLoadOnce';

interface ReviewSource {
  tasks: Task[];
  sessions: StudySession[];
}

const NO_SOURCE: ReviewSource = { tasks: [], sessions: [] };

// Tasks and study sessions of the chosen period, aggregated into review cards.
export function usePeriodReview(periodId: string | null, card: PeriodReportCard | null) {
  const startDate = card?.startDate ?? null;
  const fetcher = useCallback(async (): Promise<ReviewSource> => {
    if (!periodId) return NO_SOURCE;
    const [tasks, sessions] = await Promise.all([
      getUserTasks(periodId),
      getSessionHistory(historyDaysForPeriod(startDate)),
    ]);
    return { tasks, sessions };
  }, [periodId, startDate]);
  const { data, isLoading, error } = useLoadOnce(fetcher);
  const cards = useMemo(
    () =>
      buildPeriodReview({
        card,
        tasks: data?.tasks ?? [],
        sessions: data?.sessions ?? [],
        startDate,
        endDate: card?.endDate ?? null,
      }),
    [card, data, startDate],
  );
  return { cards, isLoading, error };
}
