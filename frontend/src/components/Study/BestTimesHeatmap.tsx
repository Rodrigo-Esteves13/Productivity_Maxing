import { useBestTimesHeatmap } from '../../hooks/useBestTimesHeatmap';
import LinesSkeleton from '../UI/LinesSkeleton';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import type { HeatmapCell } from '../../types/models';
import { weekdayLabel } from '../../lib/timeFormat';
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';
import { useActiveStudySession } from '../../context/useActiveStudySession';

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];
const HOUR_BUCKET_LABELS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];

// Intensidade da cor proporcional ao máximo de minutos numa única célula -
// não a um valor absoluto, para o heatmap continuar legível quer tenhas 2
// horas registadas no total, quer tenhas 200.
function intensityClass(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return 'bg-neutral-900 border-neutral-800';
  const ratio = minutes / maxMinutes;
  if (ratio > 0.75) return 'bg-violet-500 border-violet-400';
  if (ratio > 0.5) return 'bg-violet-600/70 border-violet-600/60';
  if (ratio > 0.25) return 'bg-violet-700/50 border-violet-700/40';
  return 'bg-violet-800/30 border-violet-800/30';
}

export default function BestTimesHeatmap() {
  const { t } = useI18n();
  const { activeSession } = useActiveStudySession();
  const { cells, isLoading, error, hasAnyData } = useBestTimesHeatmap(activeSession?.id ?? null);

  const maxMinutes = Math.max(0, ...cells.map((c) => c.totalMinutes));

  const cellAt = (dayOfWeek: number, hourBucket: number): HeatmapCell | undefined =>
    cells.find((c) => c.dayOfWeek === dayOfWeek && c.hourBucket === hourBucket);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">{t('ui.bestTimesToStudy')}</h2>
      <p className="text-xs text-neutral-500 mb-4">
        {t('ui.totalStudyTimeLoggedBy')}
      </p>

      {isLoading && <LinesSkeleton lines={5} />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && !hasAnyData && (
        <EmptyState variant="inline" message={t('ui.noCompletedStudySessionsYet')} />
      )}

      {!isLoading && !error && hasAnyData && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-10" />
                {HOUR_BUCKET_LABELS.map((label) => (
                  <th key={label} className="text-neutral-500 font-normal pb-1">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS_OF_WEEK.map((dayOfWeek) => (
                <tr key={dayOfWeek}>
                  <td className="text-neutral-500 pr-2 text-right">{weekdayLabel(dayOfWeek)}</td>
                  {HOUR_BUCKET_LABELS.map((_, hourBucket) => {
                    const cell = cellAt(dayOfWeek, hourBucket);
                    const minutes = cell?.totalMinutes ?? 0;
                    return (
                      <td key={hourBucket} className="p-0">
                        {/* Altura fixa (nao aspect-square): em largura total os
                            quadrados chegavam a 120px e o cartao a ~900px. */}
                        <div
                          title={minutes > 0 ? t('ui.minutesSessions', { minutes, sessions: cell?.sessionCount ?? 0 }) : t('ui.noData')}
                          className={`h-5 w-full rounded border ${intensityClass(minutes, maxMinutes)}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
