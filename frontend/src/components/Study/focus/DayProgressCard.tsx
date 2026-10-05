import DashboardCard, { CardHeading } from '../../UI/DashboardCard';
import ProgressRing from '../../UI/ProgressRing';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useSessionHistory } from '../../../hooks/useSessionHistory';
import { useLoadOnce } from '../../../hooks/useLoadOnce';
import { getStudyStreak } from '../../../api/studySessionsService';
import { formatDuration } from '../../../lib/timeFormat';
import { minutesSince, startOfLocalDay, type SessionSpan } from '../../../lib/studyWindow';

// Sessoes que podem tocar no dia de hoje: as de ontem a noite que passaram
// da meia-noite entram, so a parte de hoje conta.
const HISTORY_DAYS = 2;

interface DayProgressCardProps {
  // Limite diario de estudo do plano (null enquanto o plano carrega).
  dailyLimitMinutes: number | null;
}

export default function DayProgressCard({ dailyLimitMinutes }: DayProgressCardProps) {
  const { activeSession } = useActiveStudySession();
  const { sessions } = useSessionHistory(HISTORY_DAYS, activeSession?.id ?? null);
  const { data: streak } = useLoadOnce(getStudyStreak);

  const now = new Date();
  const spans: SessionSpan[] = sessions.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt }));
  if (activeSession) spans.push({ startedAt: activeSession.startedAt, endedAt: null });
  const doneMinutes = minutesSince(startOfLocalDay(now), now, spans);

  const hasLimit = dailyLimitMinutes !== null && dailyLimitMinutes > 0;
  const percent = hasLimit ? (doneMinutes / dailyLimitMinutes) * 100 : 0;
  const isOver = hasLimit && doneMinutes > dailyLimitMinutes;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">Today</CardHeading>
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={percent}
          colorClassName={isOver ? 'text-amber-500' : 'text-violet-500'}
          label="Study time today compared to your daily limit"
        >
          <span className="text-sm font-semibold text-white">{formatDuration(doneMinutes)}</span>
        </ProgressRing>
        <div className="min-w-0 text-sm">
          {hasLimit ? (
            <p className="text-neutral-300">
              {isOver
                ? `${formatDuration(doneMinutes - dailyLimitMinutes)} over your ${formatDuration(dailyLimitMinutes)} limit`
                : `${formatDuration(dailyLimitMinutes - doneMinutes)} left of your ${formatDuration(dailyLimitMinutes)} limit`}
            </p>
          ) : (
            <p className="text-neutral-400">Set a daily limit in the study plan to see your progress.</p>
          )}
          {streak && (
            <p className="mt-1.5 text-xs text-neutral-500">
              {streak.currentStreak > 0
                ? `${streak.currentStreak} day streak${streak.atRisk ? ', study today to keep it' : ''}`
                : 'No streak yet. A session today starts one.'}
            </p>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
