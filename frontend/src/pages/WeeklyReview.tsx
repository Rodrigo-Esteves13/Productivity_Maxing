import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import DashboardCard, { CardHeading } from '../components/UI/DashboardCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getWeeklyReview } from '../api/userService';
import type { WeeklyReview as WeeklyReviewData } from '../types/models';
import { useI18n } from '../i18n/useI18n';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

function TaskLink({ id, title, areaName }: { id: string; title: string; areaName: string | null }) {
  return (
    <Link to={`/tasks?open=${encodeURIComponent(id)}`} className="text-sm text-neutral-200 hover:text-violet-300">
      {title}
      {areaName && <span className="text-neutral-500"> ({areaName})</span>}
    </Link>
  );
}

// Revisao dos ultimos 7 dias + o que vem nos proximos 7. So leitura.
export default function WeeklyReview() {
  const { t } = useI18n();
  useDocumentTitle(t('review.title'));
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWeeklyReview()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageLayout>
      <PageHeader title={t('review.title')} description={t('review.description')} />
      {error && <ErrorState message={t('review.error')} />}
      {!data && !error && <p className="text-sm text-neutral-400">{t('review.loading')}</p>}
      {data && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t('review.completed')} value={String(data.completed.length)} />
            <Stat label={t('review.studied')} value={formatMinutes(data.studyMinutes)} />
            <Stat label={t('review.overdue')} value={String(data.overdueCount)} />
            <Stat label={t('review.focus')} value={data.focusAverage === null ? '-' : `${data.focusAverage}/5`} />
          </div>

          <DashboardCard>
            <CardHeading className="mb-3">{t('review.completedThisWeek')}</CardHeading>
            {data.completed.length === 0 ? (
              <p className="text-sm text-neutral-500">{t('review.nothingCompleted')}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.completed.map((t) => (
                  <li key={t.id}>
                    <TaskLink id={t.id} title={t.title} areaName={t.areaName} />
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard>
            <CardHeading className="mb-3">{t('review.studyByArea')}</CardHeading>
            {data.studyByArea.length === 0 ? (
              <p className="text-sm text-neutral-500">{t('review.noStudy')}</p>
            ) : (
              <ul className="space-y-2">
                {data.studyByArea.map((row) => (
                  <li key={row.areaName}>
                    <div className="flex justify-between text-sm text-neutral-300">
                      <span>{row.areaName}</span>
                      <span className="tabular-nums text-neutral-400">{formatMinutes(row.minutes)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-800 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-violet-500"
                        style={{ width: `${Math.round((row.minutes / data.studyByArea[0].minutes) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          {data.postponed.length > 0 && (
            <DashboardCard tone="warning">
              <CardHeading tone="warning" className="mb-3">{t('review.pushedBack')}</CardHeading>
              <ul className="space-y-1.5">
                {data.postponed.map((task) => (
                  <li key={task.id} className="flex items-baseline justify-between gap-3">
                    <TaskLink id={task.id} title={task.title} areaName={task.areaName} />
                    <span className="text-xs text-neutral-500 shrink-0">
                      {t('ui.postponedTimes', { count: task.postponedCount })}
                    </span>
                  </li>
                ))}
              </ul>
            </DashboardCard>
          )}

          <DashboardCard>
            <CardHeading className="mb-3">{t('review.comingUp')}</CardHeading>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-neutral-500">{t('review.nothingDue')}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.upcoming.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3">
                    <TaskLink id={t.id} title={t.title} areaName={t.areaName} />
                    <span className="text-xs text-neutral-500 shrink-0">
                      {new Date(t.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      )}
    </PageLayout>
  );
}
