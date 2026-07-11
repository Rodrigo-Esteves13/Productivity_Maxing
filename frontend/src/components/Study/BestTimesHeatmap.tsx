import { useBestTimesHeatmap } from '../../hooks/useBestTimesHeatmap';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import type { HeatmapCell } from '../../types/models';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  const { cells, isLoading, error, hasAnyData } = useBestTimesHeatmap();

  const maxMinutes = Math.max(0, ...cells.map((c) => c.totalMinutes));

  const cellAt = (dayOfWeek: number, hourBucket: number): HeatmapCell | undefined =>
    cells.find((c) => c.dayOfWeek === dayOfWeek && c.hourBucket === hourBucket);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Best times to study</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Total study time logged, by day of week and 4-hour block.
      </p>

      {isLoading && <LoadingState message="Loading heatmap..." />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && !hasAnyData && (
        <EmptyState message="No completed study sessions yet. Start one in the widget on the side." />
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
              {DAY_LABELS.map((dayLabel, dayOfWeek) => (
                <tr key={dayLabel}>
                  <td className="text-neutral-500 pr-2 text-right">{dayLabel}</td>
                  {HOUR_BUCKET_LABELS.map((_, hourBucket) => {
                    const cell = cellAt(dayOfWeek, hourBucket);
                    const minutes = cell?.totalMinutes ?? 0;
                    return (
                      <td key={hourBucket} className="p-0">
                        <div
                          title={minutes > 0 ? `${minutes} min (${cell?.sessionCount} sessions)` : 'No data'}
                          className={`w-full aspect-square rounded-md border ${intensityClass(minutes, maxMinutes)}`}
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
    </div>
  );
}
