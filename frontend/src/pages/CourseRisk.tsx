import type { ReactNode } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ColorDot from '../components/UI/ColorDot';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import Button from '../components/UI/Button';
import PrefetchLink from '../components/UI/PrefetchLink';
import ProgressBar from '../components/UI/ProgressBar';
import CourseRiskReasons from '../components/Dashboard/CourseRiskReasons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAbsenceLimitPref } from '../hooks/useAbsenceLimitPref';
import { useCourseRiskOverview } from '../hooks/useCourseRiskOverview';
import {
  confidenceNotice,
  formatChancePct,
  formatGradedWeight,
  hasLowConfidenceRow,
  neededSituation,
  RISK_LEVEL_STYLE,
  splitOverviewRows,
} from '../lib/courseRisk';
import type { AssessedRiskRow, RiskTranslate } from '../lib/courseRisk';
import { formatNumber } from '../lib/ratings';
import { useI18n } from '../i18n/useI18n';
import type { CourseRiskOverview, CourseRiskOverviewRow } from '../types/models';

type Translate = RiskTranslate;

// Casas decimais dos pesos e da nota necessaria mostrados na pagina.
const WEIGHT_FRACTION_DIGITS = 1;
const GRADE_FRACTION_DIGITS = 2;

// wide: ocupa a largura toda em ecras pequenos, para o 5.o bloco nao ficar sozinho.
function Tile({ label, value, hint, wide = false }: { label: string; value: string; hint?: string; wide?: boolean }) {
  return (
    <div className={`${wide ? 'col-span-2 lg:col-span-1 ' : ''}rounded-xl border border-neutral-800 bg-neutral-900/50 p-4`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-100">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm tabular-nums text-neutral-200">{value}</dd>
    </div>
  );
}

function CourseName({ row, dimmed = false }: { row: CourseRiskOverviewRow; dimmed?: boolean }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${dimmed ? 'text-neutral-400' : 'text-neutral-100'}`}>
      <ColorDot size="xs" color={row.colorHex} />
      <span className="truncate font-medium">{row.areaName}</span>
    </span>
  );
}

function AssessedCard({ row, t, lang }: { row: AssessedRiskRow; t: Translate; lang: string }) {
  const { risk } = row;
  const style = RISK_LEVEL_STYLE[risk.level];
  const dash = t('courseRisk.none');
  const weight = (value: number) => `${formatNumber(value, lang, WEIGHT_FRACTION_DIGITS)}%`;
  const chance = formatChancePct(row.passChancePct, lang);
  const confidence = confidenceNotice(row);
  const needed = neededSituation(risk);
  return (
    <li className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4" data-testid="risk-course-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <CourseName row={row} />
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}>
          {t(`courseRisk.level.${risk.level}`)}
        </span>
      </div>
      <ProgressBar
        percent={row.passChancePct}
        fillClassName={style.fill}
        label={t('courseRisk.chanceLabel', { chance })}
        semantics="meter"
      />
      {confidence && (
        <p className="mt-1 text-xs text-neutral-400" data-testid="risk-confidence">
          {t(`courseRisk.confidence.${confidence}`)}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        <Field label={t('courseRisk.field.pass')} value={chance} />
        <Field label={t('courseRisk.field.fail')} value={formatChancePct(row.failChancePct, lang)} />
        <Field label={t('courseRisk.field.track')} value={t(`courseRisk.track.${risk.track}`)} />
        <Field
          label={t('courseRisk.field.average')}
          value={risk.currentAverage === null ? dash : formatNumber(risk.currentAverage, lang, GRADE_FRACTION_DIGITS)}
        />
        <Field label={t('courseRisk.field.graded')} value={weight(risk.gradedWeightPct)} />
        <Field label={t('courseRisk.field.remaining')} value={weight(risk.remainingWeightPct)} />
        <Field
          label={t('courseRisk.field.needed')}
          value={
            needed === 'value'
              ? formatNumber(risk.neededOnRemaining ?? 0, lang, GRADE_FRACTION_DIGITS)
              : t(`courseRisk.needed.${needed}`)
          }
        />
      </dl>
      {risk.reasons.length > 0 ? (
        <CourseRiskReasons reasons={risk.reasons} t={t} lang={lang} />
      ) : (
        <p className="mt-2 text-xs text-neutral-500">{t('courseRisk.noReasons')}</p>
      )}
    </li>
  );
}

function NotEnoughDataCard({ row, minPct, t, lang }: { row: CourseRiskOverviewRow; minPct: number; t: Translate; lang: string }) {
  return (
    <li className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4" data-testid="risk-course-card-pending">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <CourseName row={row} dimmed />
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
          {t('courseRisk.notEnoughData')}
        </span>
      </div>
      <p className="text-xs text-neutral-400">
        {t('courseRisk.notEnoughData.hint', { min: minPct, graded: formatGradedWeight(row.gradedWeightPct, lang) })}
      </p>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function EmptyAction() {
  const { t } = useI18n();
  return (
    <PrefetchLink to="/areas" className="text-sm text-violet-400 underline hover:text-violet-300">
      {t('courseRisk.page.emptyAction')}
    </PrefetchLink>
  );
}

function PendingState({ message }: { message: string }) {
  return <EmptyState message={message} action={<EmptyAction />} />;
}

function Content({ overview }: { overview: CourseRiskOverview }) {
  const { t, lang } = useI18n();
  const { summary } = overview;
  if (summary.totalCourses === 0) {
    return <PendingState message={t('courseRisk.emptyCourses')} />;
  }
  const { assessed, notEnoughData } = splitOverviewRows(overview.courses);
  const dash = t('courseRisk.none');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          wide
          label={t('courseRisk.avgLabel')}
          value={summary.avgPassChancePct === null ? dash : formatChancePct(summary.avgPassChancePct, lang)}
          hint={
            summary.avgPassChancePct === null
              ? t('courseRisk.noAssessed')
              : hasLowConfidenceRow(overview.courses)
                ? t('courseRisk.confidence.avgHint')
                : undefined
          }
        />
        <Tile
          label={t('courseRisk.tile.assessed')}
          value={t('courseRisk.tile.assessedValue', { assessed: summary.assessedCourses, total: summary.totalCourses })}
        />
        <Tile label={t('courseRisk.count.high')} value={String(summary.highRiskCourses)} />
        <Tile label={t('courseRisk.count.medium')} value={String(summary.mediumRiskCourses)} />
        <Tile label={t('courseRisk.count.low')} value={String(summary.lowRiskCourses)} />
      </div>
      {assessed.length > 0 && (
        <Section title={t('courseRisk.section.assessed')}>
          <ul className="space-y-3">
            {assessed.map((row) => (
              <AssessedCard key={row.areaId} row={row} t={t} lang={lang} />
            ))}
          </ul>
        </Section>
      )}
      {notEnoughData.length > 0 && (
        <Section title={t('courseRisk.section.notEnough')}>
          <ul className="space-y-3">
            {notEnoughData.map((row) => (
              <NotEnoughDataCard key={row.areaId} row={row} minPct={summary.minGradedWeightPct} t={t} lang={lang} />
            ))}
          </ul>
        </Section>
      )}
      <p className="text-xs text-neutral-500">{t('courseRisk.page.disclaimer')}</p>
    </div>
  );
}

// Chance de passar em todas as cadeiras do periodo escolhido no topo (ou de
// todos na vista agregada). E uma estimativa heuristica, nao uma previsao.
export default function CourseRisk() {
  const { t } = useI18n();
  useDocumentTitle(t('courseRisk.page.title'));
  const { limitPct } = useAbsenceLimitPref();
  const { overview, isLoading, hasError, needsPeriod, retry } = useCourseRiskOverview(limitPct);

  const body = (() => {
    if (isLoading) return <TableSkeleton />;
    if (needsPeriod) return <PendingState message={t('courseRisk.needsPeriod')} />;
    if (hasError || !overview) {
      return (
        <div className="space-y-3">
          <ErrorState message={t('courseRisk.error')} />
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('courseRisk.retry')}
          </Button>
        </div>
      );
    }
    return <Content overview={overview} />;
  })();

  return (
    <PageLayout>
      <PageHeader title={t('courseRisk.page.title')} description={t('courseRisk.page.description')} />
      {body}
    </PageLayout>
  );
}
