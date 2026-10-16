import { Link } from 'react-router-dom';
import { TrendingUpIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { useFocusEffect } from '../../hooks/useFocusEffect';
import { useI18n } from '../../i18n/useI18n';
import FocusTrendChart from './FocusTrendChart';
import FocusScatterChart from './FocusScatterChart';
import type { FactorEffect, FocusEffect, FocusEffectStatus } from '../../types/models';
import type { TranslateVars } from '../../i18n/i18n-context';

type Translate = (key: string, vars?: TranslateVars) => string;

interface FactorMessageKeys {
  not_enough_data: string;
  no_variation: string;
  inconclusive: string;
  clearHigher: string;
  clearLower: string;
}

const FOCUS_KEYS: FactorMessageKeys = {
  not_enough_data: 'focusEffect.notEnough',
  no_variation: 'focusEffect.noVariation',
  inconclusive: 'focusEffect.inconclusive',
  clearHigher: 'focusEffect.clearHigher',
  clearLower: 'focusEffect.clearLower',
};

const INTEREST_KEYS: FactorMessageKeys = {
  not_enough_data: 'focusEffect.interestNotEnough',
  no_variation: 'focusEffect.interestNoVariation',
  inconclusive: 'focusEffect.interestInconclusive',
  clearHigher: 'focusEffect.interestClearHigher',
  clearLower: 'focusEffect.interestClearLower',
};

// "+0.4" / "-0.4": o sinal e parte da informacao.
const formatSigned = (value: number) => (value > 0 ? `+${value}` : String(value));

function factorMessage(
  factor: FactorEffect,
  keys: FactorMessageKeys,
  t: Translate,
  vars: TranslateVars,
): string {
  const status: FocusEffectStatus = factor.status;
  if (status !== 'clear') return t(keys[status], { ...vars, count: factor.sampleSize });

  const points = factor.gradePointsPerPoint ?? 0;
  const range = factor.rangeGradePoints;
  return t(points > 0 ? keys.clearHigher : keys.clearLower, {
    ...vars,
    points: formatSigned(points),
    low: formatSigned(range?.low ?? points),
    high: formatSigned(range?.high ?? points),
    count: factor.sampleSize,
  });
}

// Quanto o foco das sessoes e o interesse na cadeira mexem na nota, a
// tempo de estudo igual, medido so nos teus dados. Sem dados que cheguem,
// diz isso em vez de inventar.
export default function FocusEffectCard() {
  const { t } = useI18n();
  const { focusEffect, isLoading, error } = useFocusEffect();

  if (isLoading || error || !focusEffect) return null;
  const { focus, interest } = focusEffect satisfies FocusEffect;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <TrendingUpIcon className="shrink-0" />
        {t('focusEffect.title')}
      </CardHeading>

      <div className="space-y-2 text-sm text-neutral-200">
        <p>
          {factorMessage(focus, FOCUS_KEYS, t, {
            needed: focus.minSamplesNeeded,
            have: focus.sampleSize,
          })}
        </p>
        <p>
          {factorMessage(interest, INTEREST_KEYS, t, {
            needed: interest.minSamplesNeeded,
            areas: interest.minAreasNeeded,
            have: interest.sampleSize,
          })}
        </p>
      </div>

      <FocusTrendChart />
      <FocusScatterChart />

      <div className="mt-2 space-y-1 text-xs text-neutral-500">
        {focus.excludedUnrated > 0 && <p>{t('focusEffect.excluded', { count: focus.excludedUnrated })}</p>}
        {interest.areasMissingInterest > 0 && (
          <p>{t('focusEffect.interestMissing', { count: interest.areasMissingInterest })}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link to="/focus" className="text-violet-400 hover:text-violet-300 underline decoration-dotted">
          {t('focusEffect.action')}
        </Link>
        <Link to="/areas" className="text-violet-400 hover:text-violet-300 underline decoration-dotted">
          {t('interest.label')}
        </Link>
      </div>
    </DashboardCard>
  );
}
