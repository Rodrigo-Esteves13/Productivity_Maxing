import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Select from '../components/UI/Select';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import { PrinterIcon } from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { usePeriodReportCard } from '../hooks/usePeriodReportCard';
import { useAcademic } from '../context/useAcademic';
import { formatTaskDate } from '../lib/timeFormat';
import { useI18n } from '../i18n/useI18n';
import type { PeriodReportCard } from '../types/models';

function ReportCardTable({ card }: { card: PeriodReportCard }) {
  const { t } = useI18n();
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
                <th className="py-2 pr-3 font-medium">{t('reportCard.course')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('reportCard.credits')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('reportCard.grade')}</th>
                <th className="py-2 text-right font-medium">{t('reportCard.result')}</th>
              </tr>
            </thead>
            <tbody>
              {card.areas.map((row) => (
                <tr key={row.areaId} className="border-b border-neutral-800/60">
                  <td className="py-2 pr-3 text-neutral-200">{row.areaName}</td>
                  <td className="py-2 pr-3 text-right text-neutral-300">{row.credits ?? '-'}</td>
                  <td className="py-2 pr-3 text-right font-medium text-white">{row.average ?? '-'}</td>
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
            {card.average ?? '-'} <span className="text-xs text-neutral-500">({card.gradeScale})</span>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('reportCard.creditsEarned')}</dt>
          <dd className="text-lg font-semibold text-white">
            {card.earnedCredits} / {card.attemptedCredits}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('reportCard.passMark')}</dt>
          <dd className="text-lg font-semibold text-white">{card.passThreshold}</dd>
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
  const { card, isLoading, error } = usePeriodReportCard(periodId);

  const action = (
    <div className="print-hide flex flex-wrap items-end gap-3">
      {periods.length > 1 && (
        <Select
          id="report-card-period"
          aria-label={t('reportCard.period')}
          value={periodId ?? ''}
          onChange={(e) => setChosenId(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        disabled={!card}
        className="flex items-center gap-1.5 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
      >
        <PrinterIcon />
        {t('ui.print')}
      </button>
    </div>
  );

  const body = (() => {
    if (academicLoading || (isLoading && periodId)) return <TableSkeleton />;
    if (!periodId) return <EmptyState message={t('reportCard.noPeriod')} />;
    if (error || !card) return <ErrorState message={t('reportCard.loadError')} />;
    return <ReportCardTable card={card} />;
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
