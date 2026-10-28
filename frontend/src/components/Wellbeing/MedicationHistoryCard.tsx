import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import LinesSkeleton from '../UI/LinesSkeleton';
import SegmentedControl from '../UI/SegmentedControl';
import { useMedicationHistory, type HistoryRange } from '../../hooks/useMedicationHistory';
import { useI18n } from '../../i18n/useI18n';

const RANGES: { value: HistoryRange; labelKey: string }[] = [
  { value: 'week', labelKey: 'wellbeing.history.week' },
  { value: 'month', labelKey: 'wellbeing.history.month' },
  { value: 'quarter', labelKey: 'wellbeing.history.quarter' },
];

const PERCENT = 100;
const percentOf = (taken: number, scheduled: number) =>
  scheduled === 0 ? null : Math.min(PERCENT, Math.round((taken / scheduled) * PERCENT));

// Resumo semanal/mensal da medicacao: tomas marcadas vs tomadas, por dia e
// por medicamento, e quantas "se necessario". So conta, nao avalia.
export default function MedicationHistoryCard() {
  const { t } = useI18n();
  const { history, isLoading, error, range, setRange } = useMedicationHistory();
  const options = RANGES.map((r) => ({ value: r.value, label: t(r.labelKey) }));
  const overall = history ? percentOf(history.totals.taken, history.totals.scheduled) : null;

  return (
    <DashboardCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CardHeading>{t('wellbeing.history.title')}</CardHeading>
        <SegmentedControl options={options} value={range} onChange={setRange} size="sm" />
      </div>
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error || !history ? (
        <ErrorState message={t('wellbeing.history.loadError')} />
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
            <div
              className="mt-3 flex h-12 items-end gap-px"
              role="img"
              aria-label={t('wellbeing.history.chartLabel')}
            >
              {history.days.map((day) => {
                const pct = percentOf(day.taken, day.scheduled);
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.taken}/${day.scheduled}`}
                    // Dia sem tomas planeadas mais apagado que um dia falhado.
                    className={`flex h-full min-w-0 flex-1 items-end rounded-sm ${
                      day.scheduled === 0 ? 'bg-neutral-800/30' : 'bg-neutral-800'
                    }`}
                  >
                    {pct !== null && (
                      <div className="w-full rounded-sm bg-violet-500" style={{ height: `${pct}%` }} />
                    )}
                  </div>
                );
              })}
            </div>
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
                  <td className="py-1.5 text-neutral-200">{m.name}</td>
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
