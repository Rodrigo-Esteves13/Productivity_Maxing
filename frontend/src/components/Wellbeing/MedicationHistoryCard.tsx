import { useState } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import LinesSkeleton from '../UI/LinesSkeleton';
import SegmentedControl from '../UI/SegmentedControl';
import Button from '../UI/Button';
import { DownloadIcon } from '../UI/Icons';
import { useMedicationHistory, type HistoryRange } from '../../hooks/useMedicationHistory';
import { useI18n } from '../../i18n/useI18n';
import { useFeedback } from '../../context/useFeedback';
import { dayPercent as percentOf, medHistoryToCsv } from '../../lib/medHistoryCsv';
import { downloadTextFile } from '../../utils/downloadTextFile';

const RANGES: { value: HistoryRange; labelKey: string }[] = [
  { value: 'week', labelKey: 'wellbeing.history.week' },
  { value: 'month', labelKey: 'wellbeing.history.month' },
  { value: 'quarter', labelKey: 'wellbeing.history.quarter' },
];

const CSV_MIME = 'text/csv;charset=utf-8';

// Resumo semanal/mensal da medicacao: tomas marcadas vs tomadas, por dia e
// por medicamento, e quantas "se necessario". So conta, nao avalia.
export default function MedicationHistoryCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const { history, isLoading, error, range, setRange, reload } = useMedicationHistory(refreshKey);
  // Dia tocado: em ecras de toque nao ha hover, por isso o valor aparece por baixo.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const options = RANGES.map((r) => ({ value: r.value, label: t(r.labelKey) }));
  const overall = history ? percentOf(history.totals.taken, history.totals.scheduled) : null;

  const dayLabel = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(lang, {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  const selected = history?.days.find((d) => d.date === selectedDay) ?? null;

  const handleExport = () => {
    if (!history) return;
    const csv = medHistoryToCsv(history, {
      date: t('ux4well.history.csvDate'),
      scheduled: t('ux4well.history.csvScheduled'),
      taken: t('ux4well.history.csvTaken'),
    });
    downloadTextFile(csv, `pmaxing_medication_${history.from}_${history.to}.csv`, CSV_MIME);
    notify(t('ux4well.history.exported'), 'success');
  };

  return (
    <DashboardCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CardHeading>{t('wellbeing.history.title')}</CardHeading>
        <div className="flex flex-wrap items-center gap-2">
          {history && history.medications.length > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={handleExport}>
              <DownloadIcon className="mr-1 h-3.5 w-3.5" />
              {t('ux4well.history.export')}
            </Button>
          )}
          <SegmentedControl
            options={options}
            value={range}
            onChange={(next) => {
              setSelectedDay(null);
              setRange(next);
            }}
            size="sm"
          />
        </div>
      </div>
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error || !history ? (
        <ErrorState message={t('wellbeing.history.loadError')} onRetry={reload} />
      ) : history.medications.length === 0 ? (
        <EmptyState message={t('wellbeing.history.empty')} />
      ) : (
        <>
          <p className="text-sm text-neutral-300">
            {overall === null
              ? t('wellbeing.history.noPlanned', { asNeeded: history.totals.asNeeded })
              : t('wellbeing.history.summary', {
                  percent: overall,
                  taken: history.totals.taken,
                  scheduled: history.totals.scheduled,
                })}
          </p>

          {overall !== null && (
            <>
              <div className="mt-3 flex h-12 items-end gap-px" role="group" aria-label={t('wellbeing.history.chartLabel')}>
                {history.days.map((day) => {
                  const pct = percentOf(day.taken, day.scheduled);
                  const label = `${dayLabel(day.date)}: ${day.taken}/${day.scheduled}`;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={selectedDay === day.date}
                      onClick={() => setSelectedDay((prev) => (prev === day.date ? null : day.date))}
                      // Dia sem tomas planeadas mais apagado que um dia falhado.
                      className={`flex h-full min-w-0 flex-1 items-end rounded-sm ${
                        day.scheduled === 0 ? 'bg-neutral-800/30' : 'bg-neutral-800'
                      } ${selectedDay === day.date ? 'ring-1 ring-violet-300' : ''}`}
                    >
                      {pct !== null && (
                        <span className="block w-full rounded-sm bg-violet-500" style={{ height: `${pct}%` }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 min-h-4 text-xs text-neutral-400" aria-live="polite">
                {selected
                  ? t('ux4well.history.dayValue', {
                      date: dayLabel(selected.date),
                      taken: selected.taken,
                      scheduled: selected.scheduled,
                    })
                  : t('ux4well.history.tapHint')}
              </p>
            </>
          )}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-1 font-normal">{t('wellbeing.history.medication')}</th>
                <th className="pb-1 text-right font-normal">{t('wellbeing.history.taken')}</th>
                <th className="pb-1 text-right font-normal">{t('wellbeing.history.asNeeded')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {history.medications.map((m) => (
                <tr key={m.id}>
                  <td className="max-w-0 truncate py-1.5 text-neutral-200" title={m.name}>
                    {m.name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-300">
                    {m.scheduled > 0 ? `${m.taken}/${m.scheduled}` : '-'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-300">{m.asNeeded || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-neutral-500">{t('wellbeing.history.caveat')}</p>
        </>
      )}
    </DashboardCard>
  );
}
