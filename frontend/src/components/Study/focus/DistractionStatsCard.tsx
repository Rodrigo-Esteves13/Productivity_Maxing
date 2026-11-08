import { useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { formatDuration } from '../../../lib/timeFormat';
import type { DistractionBucket, DistractionStats } from '../../../api/studySessionsService';
import { formatFocusHour } from '../../../lib/focusHours';
import Card from '../../UI/Card';
import ColorDot from '../../UI/ColorDot';
import EmptyState from '../../UI/EmptyState';
import ErrorState from '../../UI/ErrorState';
import LinesSkeleton from '../../UI/LinesSkeleton';
import SegmentedControl, { type SegmentedOption } from '../../UI/SegmentedControl';

type View = 'hour' | 'area' | 'effort';

interface Row {
  key: string;
  label: string;
  colorHex?: string | null;
  bucket: DistractionBucket;
}

const VIEWS: View[] = ['hour', 'area', 'effort'];
const MIN_BAR_PERCENT = 4;
const PERCENT = 100;
const RATE_DECIMALS = 1;

interface Props {
  stats: DistractionStats | null;
  isLoading: boolean;
  error: string;
}

export default function DistractionStatsCard({ stats, isLoading, error }: Props) {
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>('hour');

  const options: SegmentedOption<View>[] = VIEWS.map((value) => ({
    value,
    label: t(`distractionStats.view.${value}`),
  }));

  const rows = useMemo<Row[]>(() => {
    if (!stats) return [];
    if (view === 'hour') {
      return stats.byHour.map((b) => ({ key: String(b.hour), label: formatFocusHour(b.hour, lang), bucket: b }));
    }
    if (view === 'area') {
      return stats.byArea.map((b) => ({
        key: b.areaId ?? 'none',
        label: b.areaName ?? t('distractionStats.noArea'),
        colorHex: b.areaColorHex,
        bucket: b,
      }));
    }
    return stats.byEffort.map((b) => ({
      key: b.effort,
      label: t(`distractionStats.effort.${b.effort}`),
      bucket: b,
    }));
  }, [stats, view, lang, t]);

  const maxRate = Math.max(0, ...rows.map((r) => r.bucket.distractionsPerHour));
  const allEarly = rows.length > 0 && rows.every((r) => r.bucket.lowSample);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">{t('distractionStats.title')}</h2>
      <p className="text-xs text-neutral-500 mb-4">
        {t('distractionStats.subtitle', { days: stats?.windowDays ?? '' })}
      </p>

      {isLoading && <LinesSkeleton lines={5} />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && stats && stats.totalSessions === 0 && (
        <EmptyState variant="inline" message={t('distractionStats.empty')} />
      )}

      {!isLoading && !error && stats && stats.totalSessions > 0 && (
        <>
          <SegmentedControl options={options} value={view} onChange={setView} size="sm" className="mb-4 w-fit" />

          {rows.length === 0 ? (
            <EmptyState variant="inline" message={t('distractionStats.emptyView')} />
          ) : (
            <ul className="space-y-3">
              {rows.map(({ key, label, colorHex, bucket }) => (
                <li key={key}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-neutral-200">
                      {colorHex && <ColorDot color={colorHex} size="xs" />}
                      <span className="truncate">{label}</span>
                      {bucket.lowSample && (
                        <span
                          title={t('distractionStats.earlySignalHint', { min: stats.minSessions })}
                          className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400"
                        >
                          {t('distractionStats.earlySignal')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-300">
                      {t('distractionStats.perHour', {
                        value: bucket.distractionsPerHour.toFixed(RATE_DECIMALS),
                      })}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded bg-neutral-800" aria-hidden="true">
                    <div
                      className={`h-full rounded bg-violet-500 ${bucket.lowSample ? 'opacity-40' : ''}`}
                      style={{
                        width: `${maxRate > 0 ? Math.max(MIN_BAR_PERCENT, (bucket.distractionsPerHour / maxRate) * PERCENT) : MIN_BAR_PERCENT}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('distractionStats.detail', {
                      sessions: bucket.sessions,
                      duration: formatDuration(bucket.totalMinutes),
                      distractions: bucket.distractions,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {allEarly && <p className="mt-4 text-xs text-neutral-400">{t('distractionStats.allEarly')}</p>}
          <p className="mt-4 text-xs text-neutral-500">
            {t('distractionStats.footnote', { sessions: stats.totalSessions, min: stats.minSessions })}
          </p>
        </>
      )}
    </Card>
  );
}
