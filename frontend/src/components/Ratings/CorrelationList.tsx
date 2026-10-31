import type { RatingStats } from '../../types/models';
import {
  CORRELATION_IDS,
  correlationMetaKey,
  correlationSentenceKey,
  formatNumber,
  readCorrelation,
} from '../../lib/ratings';
import { useI18n } from '../../i18n/useI18n';

// Cada correlacao numa frase simples, com r e n; "dados insuficientes"
// quando n < minSample.
export default function CorrelationList({ stats }: { stats: RatingStats }) {
  const { t, lang } = useI18n();
  return (
    <ul className="space-y-3">
      {CORRELATION_IDS.map((id) => {
        const reading = readCorrelation(stats.correlations[id]);
        if (reading.kind === 'insufficient') {
          return (
            <li key={id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <p className="text-sm text-neutral-300">{t(`ratings.corrTitle.${id}`)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {t('ratings.corr.insufficient', {
                  n: formatNumber(reading.n, lang, 0),
                  min: formatNumber(stats.minSample, lang, 0),
                })}
              </p>
            </li>
          );
        }
        if (reading.kind === 'noVariation') {
          return (
            <li key={id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <p className="text-sm text-neutral-300">{t(`ratings.corrTitle.${id}`)}</p>
              <p className="mt-1 text-xs text-neutral-500">{t('ratings.corr.noVariation')}</p>
            </li>
          );
        }
        return (
          <li key={id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <p className="text-sm text-neutral-200">{t(correlationSentenceKey(id, reading.direction))}</p>
            <p className="mt-1 text-xs tabular-nums text-neutral-500">
              {t(correlationMetaKey(reading), {
                r: formatNumber(reading.r, lang, 2),
                n: formatNumber(reading.n, lang, 0),
              })}
            </p>
            {reading.small && (
              <p className="mt-1 text-xs text-neutral-400">{t('ratings.corr.smallSample')}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
