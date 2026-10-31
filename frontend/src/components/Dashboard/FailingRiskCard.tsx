import { useMemo } from 'react';
import { useCourseRisk } from '../../hooks/useCourseRisk';
import { useAbsenceLimitPref } from '../../hooks/useAbsenceLimitPref';
import { hasVisibleRisk } from '../../lib/courseRisk';
import { AlertTriangleIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';
import CourseRiskList from './CourseRiskList';

// Risco de chumbo por cadeira, calculado no backend com as regras de
// aprovacao. Sem cadeiras em risco o cartao nao aparece; se o pedido falha
// mostra so uma linha pequena com "tentar de novo".

export default function FailingRiskCard() {
  const { t, lang } = useI18n();
  // O backend usa o limite de faltas do utilizador (preferencia so do cliente).
  const { limitPct } = useAbsenceLimitPref();
  const { risks: allRisks, isLoading, hasError, retry } = useCourseRisk(limitPct);
  const risks = useMemo(() => allRisks.filter(hasVisibleRisk), [allRisks]);
  if (isLoading) return null;

  if (hasError) {
    return (
      <p className="flex items-center gap-2 text-xs text-neutral-500" role="status">
        {t('courseRisk.error')}
        <button
          type="button"
          onClick={retry}
          className="rounded text-violet-400 underline transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
        >
          {t('courseRisk.retry')}
        </button>
      </p>
    );
  }

  if (risks.length === 0) return null;
  const isSerious = risks.some((r) => r.level === 'high' || r.level === 'extreme');

  return (
    <DashboardCard tone={isSerious ? 'danger' : undefined}>
      <CardHeading tone={isSerious ? 'danger' : undefined} className="mb-2">
        <AlertTriangleIcon className="shrink-0" />
        {t('widget.failingRisk')}
      </CardHeading>
      <p className="mb-3 text-xs text-neutral-400">{t('courseRisk.help')}</p>
      <CourseRiskList risks={risks} t={t} lang={lang} />
    </DashboardCard>
  );
}
