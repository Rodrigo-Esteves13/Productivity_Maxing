import { useEffect, useState } from 'react';
import { getEstimationAccuracy, type EstimationAccuracy } from '../../api/predictionService';
import { TargetIcon } from '../UI/Icons';

// How good Rodrigo's own manual `estimatedMinutes` guesses have actually
// been, looking backward - the counterpart to the duration-prediction
// feature on the task form, which looks forward. Deliberately its own
// card, not folded into GradingFields' inline suggestion: this is an
// aggregate across every task, a different question than "what should I
// guess for this one task right now".
export default function EstimationAccuracyCard() {
  const [data, setData] = useState<EstimationAccuracy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getEstimationAccuracy()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => console.error('Failed to load estimation accuracy:', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return null;
  // Needs a handful of real data points before this says anything
  // meaningful - same threshold philosophy as PredictionService's own
  // MIN_SAMPLES_FOR_REGRESSION, just a much lower bar since this is a
  // read-only summary, not something being trained.
  if (!data || data.sampleSize < 3) return null;

  const total = data.accurateCount + data.overestimatedCount + data.underestimatedCount;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
        <TargetIcon className="shrink-0" />
        Estimate accuracy
      </p>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-2xl font-semibold text-violet-400">
          {data.avgAbsPercentError}%
        </span>
        <span className="text-xs text-neutral-500 pb-1">
          average error, across {data.sampleSize} task{data.sampleSize === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-neutral-800 mb-2">
        <div className="h-full bg-emerald-500" style={{ width: `${pct(data.accurateCount)}%` }} />
        <div className="h-full bg-amber-500" style={{ width: `${pct(data.overestimatedCount)}%` }} />
        <div className="h-full bg-sky-500" style={{ width: `${pct(data.underestimatedCount)}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          {data.accurateCount} on target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          {data.overestimatedCount} took less than guessed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
          {data.underestimatedCount} took more than guessed
        </span>
      </div>
    </div>
  );
}
