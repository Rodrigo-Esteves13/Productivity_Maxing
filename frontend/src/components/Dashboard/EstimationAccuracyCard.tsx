import { useEffect, useState } from 'react';
import { getEstimationAccuracy, type EstimationAccuracy } from '../../api/predictionService';
import { TargetIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import LegendItem from '../UI/LegendItem';
import { useI18n } from '../../i18n/useI18n';

// How good Rodrigo's own manual `estimatedMinutes` guesses have actually
// been, looking backward - the counterpart to the duration-prediction
// feature on the task form, which looks forward. Deliberately its own
// card, not folded into GradingFields' inline suggestion: this is an
// aggregate across every task, a different question than "what should I
// guess for this one task right now".
export default function EstimationAccuracyCard() {
  const { t } = useI18n();
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
    <DashboardCard>
      <CardHeading className="mb-3">
        <TargetIcon className="shrink-0" />
        {t('ui.estimateAccuracy')}
      </CardHeading>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-2xl font-semibold text-violet-400">
          {data.avgAbsPercentError}%
        </span>
        <span className="text-xs text-neutral-500 pb-1">
          {t(data.sampleSize === 1 ? 'ui.avgErrorAcrossOne' : 'ui.avgErrorAcrossMany', { count: data.sampleSize })}
        </span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-neutral-800 mb-2">
        <div className="h-full bg-violet-500" style={{ width: `${pct(data.accurateCount)}%` }} />
        <div className="h-full bg-amber-500" style={{ width: `${pct(data.overestimatedCount)}%` }} />
        <div className="h-full bg-sky-500" style={{ width: `${pct(data.underestimatedCount)}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
        <LegendItem dotClassName="bg-violet-500">
          {t('ui.onTarget', { accurateCount: data.accurateCount })}</LegendItem>
        <LegendItem dotClassName="bg-amber-500">
          {t('ui.tookLessThanGuessed', { overestimatedCount: data.overestimatedCount })}</LegendItem>
        <LegendItem dotClassName="bg-sky-500">
          {t('ui.tookMoreThanGuessed', { underestimatedCount: data.underestimatedCount })}</LegendItem>
      </div>
    </DashboardCard>
  );
}
