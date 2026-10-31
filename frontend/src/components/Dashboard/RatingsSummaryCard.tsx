import { useMemo } from 'react';
import { useRatingStats } from '../../hooks/useRatingStats';
import { useHasAnyRating } from '../../hooks/useAreaRatings';
import { cardInsightKey, formatNumber, isSmallSample, ratedCourseCount, strongestCorrelation } from '../../lib/ratings';
import { StarIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import PrefetchLink from '../UI/PrefetchLink';
import QuadrantGrid from '../Ratings/QuadrantGrid';
import { useI18n } from '../../i18n/useI18n';

// Resumo das avaliacoes privadas de docente e cadeira. Sem nenhuma
// avaliacao o cartao nao aparece; se o pedido falha mostra so uma linha
// pequena com "tentar de novo".

// Porta barata: so pede as estatisticas (varias queries) com pelo menos uma avaliacao.
export default function RatingsSummaryCard() {
  const { isLoading, hasAny } = useHasAnyRating();
  if (isLoading || !hasAny) return null;
  return <RatingsSummaryContent />;
}

function RatingsSummaryContent() {
  const { t, lang } = useI18n();
  const { stats, isLoading, hasError, retry } = useRatingStats();
  const strongest = useMemo(() => (stats ? strongestCorrelation(stats.correlations) : null), [stats]);
  if (isLoading) return null;

  if (hasError || !stats) {
    return (
      <p className="flex items-center gap-2 text-xs text-neutral-500" role="status">
        {t('ratings.card.error')}
        <button
          type="button"
          onClick={retry}
          className="rounded text-violet-400 underline transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
        >
          {t('ratings.card.retry')}
        </button>
      </p>
    );
  }

  const rated = ratedCourseCount(stats.courses);
  if (rated === 0) return null;
  const anyReady = Object.values(stats.correlations).some((c) => c.enough);

  let insight: string;
  if (strongest) {
    insight = t(cardInsightKey(strongest.id, strongest.reading.direction, strongest.reading.n), {
      r: formatNumber(strongest.reading.r, lang, 2),
      n: formatNumber(strongest.reading.n, lang, 0),
    });
    if (isSmallSample(strongest.reading.n)) insight = `${insight} ${t('ratings.corr.smallSample')}`;
  } else if (anyReady) {
    insight = t('ratings.card.noPattern');
  } else {
    insight = t('ratings.card.needMore', { min: formatNumber(stats.minSample, lang, 0) });
  }

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <StarIcon className="shrink-0" />
        {t('widget.ratingsSummary')}
      </CardHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuadrantGrid compact title={t('ratings.teacher')} quadrants={stats.quadrants.teacher} />
        <QuadrantGrid compact title={t('ratings.course')} quadrants={stats.quadrants.course} />
      </div>
      <p className="mt-3 text-xs text-neutral-400">{insight}</p>
      <PrefetchLink
        to="/ratings"
        className="mt-3 inline-block text-xs text-violet-400 underline transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
      >
        {t('ratings.card.seeDetails')}
      </PrefetchLink>
    </DashboardCard>
  );
}
