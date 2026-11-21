import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../UI/Card';
import ErrorState from '../UI/ErrorState';
import ExportChartButton from '../UI/ExportChartButton';
import LegendItem from '../UI/LegendItem';
import LinesSkeleton from '../UI/LinesSkeleton';
import Select from '../UI/Select';
import { getFlashcardForecast } from '../../api/flashcardsService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useNotebookAreas } from '../../hooks/useNotebookAreas';
import { useI18n } from '../../i18n/useI18n';
import {
  FLASHCARD_FORECAST_HEAVY_DAY,
  FLASHCARD_FORECAST_NO_AREA,
  FLASHCARD_FORECAST_SUMMARY_DAYS,
  areaIdsWithCards,
  buildBars,
  busiestDay,
  examsForArea,
  totalInNextDays,
  type ForecastBar,
} from '../../lib/flashcardForecast';

const EXPORT_FILENAME_SLUG = 'flashcard-forecast';
const BAR_COLOR = 'var(--color-violet-500)';
const HEAVY_COLOR = 'var(--color-amber-400)';
const EXAM_COLOR = 'var(--color-violet-300)';
const GRID_COLOR = 'var(--color-neutral-800)';
const AXIS_COLOR = 'var(--color-neutral-500)';
const AXIS_LINE_COLOR = 'var(--color-neutral-700)';
const TICK_SIZE = 11;
const AXIS_WIDTH = 32;
const BAR_RADIUS = 3;
const MIN_TICK_GAP = 12;
const CHART_MARGIN = { top: 16, right: 12, bottom: 0, left: 0 };

function BarTooltip({ active, payload }: { active?: boolean; payload?: { payload: ForecastBar }[] }) {
  const { t, lang } = useI18n();
  if (!active || !payload?.length) return null;
  const bar = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl">
      <p className="text-neutral-400">{new Date(`${bar.date}T00:00:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <p className="font-semibold text-violet-300 tabular-nums">{t('flashcardForecast.tooltipCards', { count: bar.count })}</p>
      {bar.examTitles.map((title) => (
        <p key={title} className="text-neutral-300">{t('flashcardForecast.tooltipExam', { title })}</p>
      ))}
      {bar.heavyBeforeExam && <p className="text-amber-400">{t('flashcardForecast.tooltipHeavy')}</p>}
    </div>
  );
}

// Previsao das revisoes de cartoes a vencer nos proximos 30 dias.
interface Props {
  /** Muda quando as cartas mudam, para recarregar a previsao. */
  refreshKey?: string;
}

export default function FlashcardForecast({ refreshKey }: Props) {
  const { t, lang } = useI18n();
  const { data, isLoading, error, reload } = useLoadOnce(getFlashcardForecast, refreshKey);
  const { areas } = useNotebookAreas();
  const [areaKey, setAreaKey] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);

  const areaId = areaKey === '' ? null : areaKey;
  const bars = useMemo(() => (data ? buildBars(data, areaId) : []), [data, areaId]);
  const areaOptions = useMemo(() => (data ? areaIdsWithCards(data.days) : []), [data]);
  const areaName = (id: string) =>
    id === FLASHCARD_FORECAST_NO_AREA ? t('flashcardForecast.areaNone') : (areas.find((a) => a.id === id)?.name ?? id);
  const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' });

  const total = bars.reduce((sum, b) => sum + b.count, 0);
  const busiest = busiestDay(bars);
  const weekTotal = totalInNextDays(bars);
  const heavyDates = bars.filter((b) => b.heavyBeforeExam).map((b) => formatDay(b.date));
  const examBars = bars.filter((b) => b.examTitles.length > 0);
  const hasExams = data ? examsForArea(data.exams, areaId).some((e) => bars.some((b) => b.date === e.date)) : false;

  let body;
  if (isLoading) {
    body = <LinesSkeleton lines={4} />;
  } else if (error || !data) {
    body = <ErrorState message={t('flashcardForecast.error')} onRetry={reload} />;
  } else if (areaOptions.length === 0 && areaId === null && data.days.every((d) => d.total === 0)) {
    body = <p className="text-sm text-neutral-400">{t('flashcardForecast.empty')}</p>;
  } else {
    const summary = busiest
      ? t('flashcardForecast.summary', { week: weekTotal, days: FLASHCARD_FORECAST_SUMMARY_DAYS, date: formatDay(busiest.date), count: busiest.count })
      : t('flashcardForecast.summaryNone', { days: FLASHCARD_FORECAST_SUMMARY_DAYS });
    body = (
      <div className="space-y-3">
        <div className="sm:max-w-xs">
          <Select label={t('flashcardForecast.area')} value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
            <option value="">{t('flashcardForecast.areaAll')}</option>
            {areaOptions.map((id) => (
              <option key={id} value={id}>{areaName(id)}</option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-neutral-300">{summary}</p>
        {heavyDates.length > 0 && (
          <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
            {t('flashcardForecast.heavyWarning', { limit: FLASHCARD_FORECAST_HEAVY_DAY, dates: heavyDates.join(', ') })}
          </p>
        )}
        {total === 0 ? (
          <p className="text-sm text-neutral-400">{t('flashcardForecast.emptyArea')}</p>
        ) : (
          <>
            <div
              ref={chartRef}
              role="img"
              aria-label={t('flashcardForecast.aria', { total, days: bars.length })}
              className="relative h-56 w-full"
            >
              <ExportChartButton containerRef={chartRef} filenameSlug={EXPORT_FILENAME_SLUG} className="absolute right-0 top-0 z-10" />
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={CHART_MARGIN}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    minTickGap={MIN_TICK_GAP}
                    tick={{ fill: AXIS_COLOR, fontSize: TICK_SIZE }}
                    axisLine={{ stroke: AXIS_LINE_COLOR }}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: TICK_SIZE }} axisLine={false} tickLine={false} width={AXIS_WIDTH} />
                  <ReferenceLine y={FLASHCARD_FORECAST_HEAVY_DAY} stroke={HEAVY_COLOR} strokeDasharray="4 4" strokeOpacity={0.7} />
                  {examBars.map((b) => (
                    <ReferenceLine key={b.date} x={b.date} stroke={EXAM_COLOR} strokeDasharray="2 3" strokeOpacity={0.8} />
                  ))}
                  <Tooltip content={<BarTooltip />} cursor={{ fill: GRID_COLOR, fillOpacity: 0.5 }} />
                  <Bar dataKey="count" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} isAnimationActive={false}>
                    {bars.map((b) => (
                      <Cell key={b.date} fill={b.heavyBeforeExam ? HEAVY_COLOR : BAR_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
              <LegendItem dotClassName="bg-violet-500">{t('flashcardForecast.legendCards')}</LegendItem>
              {hasExams && <LegendItem dotClassName="bg-violet-300">{t('flashcardForecast.legendExam')}</LegendItem>}
              <LegendItem dotClassName="bg-amber-400">{t('flashcardForecast.legendHeavy', { limit: FLASHCARD_FORECAST_HEAVY_DAY })}</LegendItem>
            </div>
            <table className="sr-only">
              <caption>{t('flashcardForecast.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('flashcardForecast.colDate')}</th>
                  <th scope="col">{t('flashcardForecast.colCards')}</th>
                  <th scope="col">{t('flashcardForecast.colExam')}</th>
                </tr>
              </thead>
              <tbody>
                {bars.map((b) => (
                  <tr key={b.date}>
                    <th scope="row">{formatDay(b.date)}</th>
                    <td>{b.count}</td>
                    <td>{b.examTitles.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-base font-semibold text-white">{t('flashcardForecast.title')}</h2>
      {body}
    </Card>
  );
}
