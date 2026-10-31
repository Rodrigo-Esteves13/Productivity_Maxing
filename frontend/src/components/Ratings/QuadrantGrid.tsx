import type { RatingQuadrants } from '../../types/models';
import { QUADRANT_MIN_RATED, quadrantTotal } from '../../lib/ratings';
import { useI18n } from '../../i18n/useI18n';

interface QuadrantGridProps {
  title: string;
  quadrants: RatingQuadrants;
  // Versao pequena para o cartao do Dashboard (sem estado vazio longo).
  compact?: boolean;
}

function Cell({ count, label, isTop, compact }: { count: number; label: string; isTop: boolean; compact: boolean }) {
  return (
    <div
      className={`rounded-lg border text-center ${compact ? 'px-2 py-1.5' : 'px-3 py-3'} ${
        isTop ? 'border-violet-500/60 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/40'
      }`}
      aria-label={label}
      title={label}
    >
      <p className={`font-semibold tabular-nums text-white ${compact ? 'text-base' : 'text-xl'}`}>{count}</p>
    </div>
  );
}

// 2x2: gostar (>= 4) / nao gostar (<= 2) contra nota alta / baixa (face a
// media das tuas cadeiras). Contagens de cadeiras, o 3 fica de fora.
export default function QuadrantGrid({ title, quadrants, compact = false }: QuadrantGridProps) {
  const { t } = useI18n();
  const total = quadrantTotal(quadrants);
  const isTooFew = total < QUADRANT_MIN_RATED;
  const max = Math.max(
    quadrants.likedGradeHigh,
    quadrants.likedGradeLow,
    quadrants.notLikedGradeHigh,
    quadrants.notLikedGradeLow,
  );
  const cells = [
    { count: quadrants.likedGradeHigh, label: t('ratings.quadrant.likedHigh') },
    { count: quadrants.likedGradeLow, label: t('ratings.quadrant.likedLow') },
    { count: quadrants.notLikedGradeHigh, label: t('ratings.quadrant.notLikedHigh') },
    { count: quadrants.notLikedGradeLow, label: t('ratings.quadrant.notLikedLow') },
  ];
  const headClass = 'px-1 text-[11px] uppercase tracking-wide text-neutral-500';

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-neutral-200">{title}</h3>
      {total === 0 ? (
        <p className="text-xs text-neutral-500">{t('ratings.quadrant.empty')}</p>
      ) : (
        <div className="grid grid-cols-[minmax(4.5rem,auto)_1fr_1fr] items-center gap-1.5">
          <span />
          <span className={`${headClass} text-center`} title={t('ratings.tip.gradeHigh')}>
            {t('ratings.quadrant.gradeHigh')}
          </span>
          <span className={`${headClass} text-center`} title={t('ratings.tip.gradeLow')}>
            {t('ratings.quadrant.gradeLow')}
          </span>
          <span className={headClass} title={t('ratings.tip.liked')}>
            {t('ratings.quadrant.liked')}
          </span>
          <Cell {...cells[0]} isTop={!isTooFew && cells[0].count === max} compact={compact} />
          <Cell {...cells[1]} isTop={!isTooFew && cells[1].count === max} compact={compact} />
          <span className={headClass} title={t('ratings.tip.notLiked')}>
            {t('ratings.quadrant.notLiked')}
          </span>
          <Cell {...cells[2]} isTop={!isTooFew && cells[2].count === max} compact={compact} />
          <Cell {...cells[3]} isTop={!isTooFew && cells[3].count === max} compact={compact} />
        </div>
      )}
      {total > 0 && isTooFew && (
        <p className="mt-2 text-xs text-neutral-500">{t('ratings.quadrant.tooFew', { min: String(QUADRANT_MIN_RATED) })}</p>
      )}
    </div>
  );
}
