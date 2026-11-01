import { useAbsenceLimitPref } from '../../hooks/useAbsenceLimitPref';
import { useCourseRiskOverview } from '../../hooks/useCourseRiskOverview';
import {
  confidenceNotice,
  DASHBOARD_RISK_ROWS_MAX,
  formatChancePct,
  formatGradedWeight,
  hasLowConfidenceRow,
  hasSeriousRisk,
  isAssessedRow,
  RISK_LEVEL_STYLE,
} from '../../lib/courseRisk';
import type { RiskTranslate } from '../../lib/courseRisk';
import { AlertTriangleIcon } from '../UI/Icons';
import ColorDot from '../UI/ColorDot';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import PrefetchLink from '../UI/PrefetchLink';
import ProgressBar from '../UI/ProgressBar';
import { useI18n } from '../../i18n/useI18n';
import type { CourseRiskOverviewRow, CourseRiskSummary } from '../../types/models';

// Resumo sempre visivel do risco de chumbo: media da chance de passar,
// contagens por nivel, a pior cadeira e uma lista compacta. A chance e uma
// estimativa heuristica do backend (100 - pontuacao), dita assim no texto.
// Se o pedido falha mostra so uma linha pequena com "tentar de novo".

type Translate = RiskTranslate;

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5">
      <p className="text-lg font-semibold tabular-nums text-neutral-100">{value}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}

function CourseRow({ row, summary, t, lang }: { row: CourseRiskOverviewRow; summary: CourseRiskSummary; t: Translate; lang: string }) {
  const nameCell = (
    <span className="flex min-w-0 items-center gap-2">
      <ColorDot size="xs" color={row.colorHex} />
      <span className="truncate">{row.areaName}</span>
    </span>
  );
  if (!isAssessedRow(row)) {
    return (
      <li className="text-sm" data-testid="risk-summary-row">
        <div className="flex items-center justify-between gap-2 text-neutral-400">
          {nameCell}
          <span className="shrink-0 text-xs text-neutral-400">{t('courseRisk.notEnoughData')}</span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          {t('courseRisk.notEnoughData.hint', { min: summary.minGradedWeightPct, graded: formatGradedWeight(row.gradedWeightPct, lang) })}
        </p>
      </li>
    );
  }
  const chance = formatChancePct(row.passChancePct, lang);
  const confidence = confidenceNotice(row);
  return (
    <li className="text-sm" data-testid="risk-summary-row">
      <div className="mb-1 flex items-center justify-between gap-2 text-neutral-200">
        {nameCell}
        <span className="shrink-0 tabular-nums text-neutral-300">{chance}</span>
      </div>
      <ProgressBar
        percent={row.passChancePct}
        fillClassName={RISK_LEVEL_STYLE[row.risk.level].fill}
        label={t('courseRisk.chanceLabel', { chance })}
        semantics="meter"
      />
      {confidence && <p className="mt-0.5 text-xs text-neutral-400">{t(`courseRisk.confidence.${confidence}`)}</p>}
    </li>
  );
}

export default function FailingRiskCard() {
  const { t, lang } = useI18n();
  // O backend usa o limite de faltas do utilizador (preferencia so do cliente).
  const { limitPct } = useAbsenceLimitPref();
  const { overview, isLoading, hasError, needsPeriod, retry } = useCourseRiskOverview(limitPct);
  if (isLoading) return null;

  if (needsPeriod) {
    return (
      <DashboardCard>
        <CardHeading className="mb-2">
          <AlertTriangleIcon className="shrink-0" />
          {t('widget.failingRisk')}
        </CardHeading>
        <p className="text-xs text-neutral-400">{t('courseRisk.needsPeriod')}</p>
      </DashboardCard>
    );
  }

  if (hasError || !overview) {
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

  const { summary, courses } = overview;
  const isSerious = hasSeriousRisk(summary);
  const tone = isSerious ? 'danger' : undefined;
  const visibleCourses = courses.slice(0, DASHBOARD_RISK_ROWS_MAX);
  const hiddenCount = courses.length - visibleCourses.length;

  return (
    <DashboardCard tone={tone}>
      <CardHeading tone={tone} className="mb-2">
        <AlertTriangleIcon className="shrink-0" />
        {t('widget.failingRisk')}
      </CardHeading>
      {summary.totalCourses === 0 ? (
        <p className="text-xs text-neutral-400">{t('courseRisk.emptyCourses')}</p>
      ) : (
        <>
          <p className="text-xs text-neutral-400">{t('courseRisk.avgLabel')}</p>
          <p className="text-4xl font-semibold tabular-nums text-neutral-100" data-testid="risk-summary-avg">
            {summary.avgPassChancePct === null ? t('courseRisk.none') : formatChancePct(summary.avgPassChancePct, lang)}
          </p>
          <p className="mb-3 text-xs text-neutral-500">
            {summary.avgPassChancePct === null
              ? t('courseRisk.noAssessed')
              : t('courseRisk.assessedOf', { assessed: summary.assessedCourses, total: summary.totalCourses })}
          </p>
          {summary.avgPassChancePct !== null && hasLowConfidenceRow(courses) && (
            <p className="-mt-2 mb-3 text-xs text-neutral-400" data-testid="risk-summary-low-confidence">
              {t('courseRisk.confidence.avgHint')}
            </p>
          )}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <CountTile label={t('courseRisk.count.high')} value={summary.highRiskCourses} />
            <CountTile label={t('courseRisk.count.medium')} value={summary.mediumRiskCourses} />
            <CountTile label={t('courseRisk.count.low')} value={summary.lowRiskCourses} />
          </div>
          {summary.worst && (
            <p className="mb-3 text-xs text-neutral-300" data-testid="risk-summary-worst">
              {t('courseRisk.worst', { name: summary.worst.areaName, chance: formatChancePct(summary.worst.passChancePct, lang) })}
            </p>
          )}
          <ul className="space-y-3">
            {visibleCourses.map((row) => (
              <CourseRow key={row.areaId} row={row} summary={summary} t={t} lang={lang} />
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-neutral-500">{t('courseRisk.estimateNote')}</p>
      <PrefetchLink
        to="/risk"
        className="mt-2 inline-block text-xs text-violet-400 underline transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
      >
        {hiddenCount > 0 ? t('courseRisk.moreCourses', { count: hiddenCount }) : t('courseRisk.seeAll')}
      </PrefetchLink>
    </DashboardCard>
  );
}
