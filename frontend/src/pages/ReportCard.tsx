import { useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Select from '../components/UI/Select';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import GradeImprovementCard from '../components/Grades/GradeImprovementCard';
import { DownloadIcon, PrinterIcon } from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { usePeriodReportCard } from '../hooks/usePeriodReportCard';
import { useTableSort } from '../hooks/useTableSort';
import { sortReportCardRows, type ReportCardSortKey } from '../lib/reportCardSort';
import { useAcademic } from '../context/useAcademic';
import { formatTaskDate } from '../lib/timeFormat';
import { formatNumber } from '../lib/ratings';
import { periodOptionLabel, sortPeriodsForSelect } from '../lib/periodOptions';
import { downloadTextFile } from '../utils/downloadTextFile';
import { reportCardFileName, reportCardToCsv } from '../utils/reportCardCsv';
import { useI18n } from '../i18n/useI18n';
import type { PeriodReportCard } from '../types/models';

const GRADE_FRACTION_DIGITS = 2;
const CREDITS_FRACTION_DIGITS = 1;
const CSV_MIME_TYPE = 'text/csv;charset=utf-8';

// Colunas ordenaveis; `end` alinha a direita (numeros).
const COLUMNS: { key: ReportCardSortKey; label: string; end: boolean }[] = [
  { key: 'course', label: 'reportCard.course', end: false },
  { key: 'credits', label: 'reportCard.credits', end: true },
  { key: 'grade', label: 'reportCard.grade', end: true },
  { key: 'result', label: 'reportCard.result', end: true },
];
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SORT_MARK = { asc: '▲', desc: '▼' } as const;

function ReportCardTable({ card }: { card: PeriodReportCard }) {
  const { t, lang } = useI18n();
  const { sort, toggleKey } = useTableSort<ReportCardSortKey>();
  const rows = sortReportCardRows(card.areas, sort, lang);
  const grade = (value: number | null) => (value === null ? '-' : formatNumber(value, lang, GRADE_FRACTION_DIGITS));
  const dates = card.endDate
    ? `${formatTaskDate(card.startDate)} - ${formatTaskDate(card.endDate)}`
    : formatTaskDate(card.startDate);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 print:border-0 print:p-0">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{card.programName}</p>
        <h2 className="text-xl font-semibold text-white">{card.periodName}</h2>
        <p className="text-sm text-neutral-400">{dates}</p>
      </header>
      {card.areas.length === 0 ? (
        <EmptyState variant="inline" message={t('reportCard.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-400">
                {COLUMNS.map(({ key, label, end }) => {
                  const active = sort?.key === key;
                  return (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={active ? ARIA_SORT[sort.direction] : undefined}
                      className={`py-2 pr-3 font-medium last:pr-0 ${end ? 'text-right' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleKey(key)}
                        title={t('ux4global.report.sortBy', { column: t(label) })}
                        className="inline-flex items-center gap-1 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 pointer-coarse:min-h-11"
                      >
                        {t(label)}
                        {/* Sempre ocupa espaco, para a coluna nao saltar. */}
                        <span aria-hidden="true" className={`print-hide text-xs ${active ? 'text-violet-400' : 'text-neutral-700'}`}>
                          {SORT_MARK[active ? sort.direction : 'asc']}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.areaId} className="border-b border-neutral-800/60">
                  <td className="py-2 pr-3 text-neutral-200">{row.areaName}</td>
                  <td className="py-2 pr-3 text-right text-neutral-300">{row.credits === null ? '-' : formatNumber(row.credits, lang, CREDITS_FRACTION_DIGITS)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-white">{grade(row.average)}</td>
                  <td className={`py-2 text-right ${row.passed ? 'text-violet-300' : 'text-neutral-400'}`}>
                    {t(row.passed ? 'reportCard.passed' : 'reportCard.notPassed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-500">{t('reportCard.average')}</dt>
          <dd className="text-lg font-semibold text-white">
            {grade(card.average)} <span className="text-xs text-neutral-500">({card.gradeScale})</span>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('reportCard.creditsEarned')}</dt>
          <dd className="text-lg font-semibold text-white">
            {formatNumber(card.earnedCredits, lang, CREDITS_FRACTION_DIGITS)} /{' '}
            {formatNumber(card.attemptedCredits, lang, CREDITS_FRACTION_DIGITS)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('reportCard.passMark')}</dt>
          <dd className="text-lg font-semibold text-white">{formatNumber(card.passThreshold, lang, GRADE_FRACTION_DIGITS)}</dd>
        </div>
      </dl>
    </section>
  );
}

// Boletim imprimivel de um periodo (semestre/ano). Usa o @media print que ja
// existe: navbar/rodape/botoes tem print-hide.
export default function ReportCard() {
  const { t } = useI18n();
  useDocumentTitle(t('reportCard.title'));
  const { periods, activePeriod, isLoading: academicLoading } = useAcademic();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const periodId = chosenId ?? activePeriod?.id ?? periods[0]?.id ?? null;
  const { card, isLoading, error, reload } = usePeriodReportCard(periodId);
  const sortedPeriods = useMemo(() => sortPeriodsForSelect(periods), [periods]);

  const handleDownloadCsv = () => {
    if (card) downloadTextFile(reportCardToCsv(card, t), reportCardFileName(card), CSV_MIME_TYPE);
  };

  const action = (
    <div className="print-hide flex flex-wrap items-end gap-3">
      {periods.length > 1 && (
        <Select
          id="report-card-period"
          aria-label={t('reportCard.period')}
          value={periodId ?? ''}
          onChange={(e) => setChosenId(e.target.value)}
        >
          {sortedPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {periodOptionLabel(p, t('period.archivedTag'))}
            </option>
          ))}
        </Select>
      )}
      <button
        type="button"
        onClick={handleDownloadCsv}
        disabled={!card}
        className="flex items-center gap-1.5 py-2.5 pointer-coarse:min-h-11 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50 pointer-coarse:min-h-11"
      >
        <DownloadIcon />
        {t('ux4areas.downloadCsv')}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        disabled={!card}
        className="flex items-center gap-1.5 py-2.5 pointer-coarse:min-h-11 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
      >
        <PrinterIcon />
        {t('ui.print')}
      </button>
    </div>
  );

  const body = (() => {
    if (academicLoading || (isLoading && periodId)) return <TableSkeleton />;
    if (!periodId) return <EmptyState message={t('reportCard.noPeriod')} />;
    if (error || !card) return <ErrorState message={t('reportCard.loadError')} onRetry={reload} />;
    return (
      <>
        <ReportCardTable card={card} />
        <GradeImprovementCard card={card} />
      </>
    );
  })();

  return (
    <PageLayout>
      <div className="print-ink">
        <PageHeader title={t('reportCard.title')} description={t('reportCard.description')} action={action} />
        {body}
      </div>
    </PageLayout>
  );
}
