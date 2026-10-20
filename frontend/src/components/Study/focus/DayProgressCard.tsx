import DashboardCard, { CardHeading } from '../../UI/DashboardCard';
import ProgressRing from '../../UI/ProgressRing';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useSessionHistory } from '../../../hooks/useSessionHistory';
import { useLoadOnce } from '../../../hooks/useLoadOnce';
import { useNow } from '../../../hooks/useNow';
import { getStudyStreak } from '../../../api/studySessionsService';
import { formatDuration } from '../../../lib/timeFormat';
import { minutesSince, startOfLocalDay, type SessionSpan } from '../../../lib/studyWindow';
import { useI18n } from '../../../i18n/useI18n';
import DueTodayList from './DueTodayList';

// Sessoes que podem tocar no dia de hoje: as de ontem a noite que passaram
// da meia-noite entram, so a parte de hoje conta.
const HISTORY_DAYS = 2;

interface DayProgressCardProps {
  // Limite diario de estudo do plano (null enquanto o plano carrega).
  dailyLimitMinutes: number | null;
}

export default function DayProgressCard({ dailyLimitMinutes }: DayProgressCardProps) {
  const { t } = useI18n();
  const { activeSession } = useActiveStudySession();
  const { sessions } = useSessionHistory(HISTORY_DAYS, activeSession?.id ?? null);
  const { data: streak } = useLoadOnce(getStudyStreak, activeSession?.id ?? null);

  // De minuto a minuto: com uma sessao a correr, o anel avanca sozinho.
  const now = useNow();
  const spans: SessionSpan[] = sessions.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt }));
  if (activeSession) spans.push({ startedAt: activeSession.startedAt, endedAt: null });
  const doneMinutes = minutesSince(startOfLocalDay(now), now, spans);

  const hasLimit = dailyLimitMinutes !== null && dailyLimitMinutes > 0;
  const percent = hasLimit ? (doneMinutes / dailyLimitMinutes) * 100 : 0;
  const isOver = hasLimit && doneMinutes > dailyLimitMinutes;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">{t('ui.today')}</CardHeading>
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={percent}
          colorClassName={isOver ? 'text-amber-500' : 'text-violet-500'}
          label={t('ui.studyTimeTodayComparedTo')}
        >
          <span className="text-sm font-semibold text-white">{formatDuration(doneMinutes)}</span>
        </ProgressRing>
        <div className="min-w-0 text-sm">
          {hasLimit ? (
            <p className="text-neutral-300">
              {isOver
                ? t('ui.overYourLimit', { over: formatDuration(doneMinutes - dailyLimitMinutes), limit: formatDuration(dailyLimitMinutes) })
                : t('ui.leftOfYourLimit', { left: formatDuration(dailyLimitMinutes - doneMinutes), limit: formatDuration(dailyLimitMinutes) })}
            </p>
          ) : (
            <p className="text-neutral-400">{t('ui.setADailyLimitIn')}</p>
          )}
          {streak && (
            <p className="mt-1.5 text-xs text-neutral-500">
              {streak.currentStreak > 0
                ? t(streak.atRisk ? 'ui.dayStreakAtRisk' : 'ui.dayStreak', { count: streak.currentStreak })
                : t('ui.noStreakYetASession')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <DueTodayList />
      </div>
    </DashboardCard>
  );
}
