import Skeleton from '../UI/Skeleton';
import type { AreaSummary } from '../../lib/areaList';
import { useI18n } from '../../i18n/useI18n';

interface AreaSummaryStripProps {
  summary: AreaSummary;
  // Tarefas e risco ainda a chegar: esses mosaicos ficam em esqueleto.
  overviewLoading: boolean;
}

// Mesmo mosaico de numero do WeeklyReview (Stat), com algarismos tabulares.
function Tile({ label, value, sub, valueClassName = 'text-white' }: { label: string; value: string; sub?: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 in-data-[theme=light]:shadow-sm">
      <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}>{value}</p>
      {sub && <p className="truncate text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function TileSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 in-data-[theme=light]:shadow-sm"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-10" />
    </div>
  );
}

// Reserva o espaco da faixa inteira enquanto as areas carregam (4 mosaicos).
export function AreaSummaryStripSkeleton() {
  return (
    <div aria-hidden="true" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TileSkeleton />
      <TileSkeleton />
      <TileSkeleton />
      <TileSkeleton />
    </div>
  );
}

// Numeros da pagina Areas: total, ligadas, tarefas abertas e cadeiras em
// risco. Os mosaicos sem dados nao aparecem.
export default function AreaSummaryStrip({ summary, overviewLoading }: AreaSummaryStripProps) {
  const { t, lang } = useI18n();
  const format = (value: number) => new Intl.NumberFormat(lang).format(value);

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label={t('areas.summary.total')} value={format(summary.total)} />
      <Tile
        label={t('areas.summary.active')}
        value={format(summary.active)}
        sub={summary.off > 0 ? t('areas.summary.off', { count: format(summary.off) }) : undefined}
      />
      {overviewLoading ? (
        <>
          <TileSkeleton />
          <TileSkeleton />
        </>
      ) : (
        <>
          {summary.openTasks !== null && <Tile label={t('areas.summary.openTasks')} value={format(summary.openTasks)} />}
          {summary.atRisk !== null && (
            <Tile
              label={t('areas.summary.atRisk')}
              value={format(summary.atRisk)}
              sub={t('areas.summary.atRiskHint')}
              valueClassName={summary.atRisk > 0 ? 'text-red-300' : 'text-white'}
            />
          )}
        </>
      )}
    </div>
  );
}
