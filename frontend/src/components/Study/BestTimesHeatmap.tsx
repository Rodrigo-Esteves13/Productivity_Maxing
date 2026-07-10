import { useEffect, useState } from 'react';
import LoadingState from '../UI/LoadingState';
import { getBestTimes } from '../../api/studyService';
import type { BestTimesResponse } from '../../types/models';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Escala simples de intensidade em violeta (opacidade 15%-90% aplicada
// inline no call site) - sem depender de nenhuma lib de gráficos só para
// isto.
function scoreToColor(score: number | null): string {
  return score === null ? 'bg-neutral-800/60' : 'bg-violet-500';
}

export default function BestTimesHeatmap() {
  const [data, setData] = useState<BestTimesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getBestTimes()
      .then(setData)
      .catch(() => setError('Could not load your study pattern yet.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <LoadingState message="Reading your study pattern..." className="h-40" />;
  }

  if (error) {
    return <p className="text-sm text-neutral-500">{error}</p>;
  }

  if (!data || !data.hasEnoughData) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Still learning your pattern</p>
        <p className="text-xs text-neutral-500 mt-2">
          {data
            ? `You've rated ${data.sampleSize} session${data.sampleSize === 1 ? '' : 's'} so far - need at least ${
                data.minSamplesNeeded
              } before showing anything. Keep using the timer above and rating how sessions go.`
            : 'Start a study session and rate it when it ends - that\'s what teaches this.'}
        </p>
      </div>
    );
  }

  const hourBuckets = Array.from(new Set(data.cells.map((c) => `${c.hourStart}-${c.hourEnd}-${c.label}`))).map(
    (key) => {
      const [start, end, label] = key.split('-');
      return { start: Number(start), end, label };
    },
  );

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-neutral-200">Best times to study</p>
        <span className="text-xs text-neutral-500">
          {data.isHeuristic ? `Simple average - ${data.sampleSize} sessions` : `Predicted model - ${data.sampleSize} sessions`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-20"></th>
              {DAY_LABELS.map((d) => (
                <th key={d} className="font-medium text-neutral-400 pb-1">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourBuckets.map((bucket) => (
              <tr key={bucket.start}>
                <td className="text-neutral-500 text-right pr-2 whitespace-nowrap">{bucket.label}</td>
                {DAY_LABELS.map((_, dayOfWeek) => {
                  const cell = data.cells.find(
                    (c) => c.dayOfWeek === dayOfWeek && c.hourStart === bucket.start,
                  );
                  const score = cell?.score ?? null;
                  return (
                    <td key={dayOfWeek} className="p-0">
                      <div
                        className={`h-8 rounded ${scoreToColor(score)}`}
                        style={score !== null ? { opacity: 0.15 + score * 0.75 } : undefined}
                        title={
                          score !== null
                            ? `${Math.round(score * 100)}% (${cell?.sessionCount ?? 0} sessions)`
                            : 'No data'
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-600 mt-3">
        {data.isHeuristic
          ? 'Based on a simple average of your ratings per time slot. Once you have more data, this switches to a trained prediction that can also fill in slots you haven\'t tried yet.'
          : 'Predicted with a logistic regression trained on your session history - it can suggest slots even if you\'ve never studied then.'}
      </p>
    </div>
  );
}
