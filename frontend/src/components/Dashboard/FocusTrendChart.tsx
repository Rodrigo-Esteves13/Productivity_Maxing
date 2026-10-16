import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useFocusTrend } from '../../hooks/useFocusTrend';
import { useI18n } from '../../i18n/useI18n';
import { FULL_PERCENT } from '../../lib/percent';
import { RATING_MAX, RATING_MIN } from '../../lib/rating';
import type { FocusTrendWeek } from '../../types/models';
import LegendItem from '../UI/LegendItem';

// Semanas com algum dado (foco ou nota) para o grafico fazer sentido.
const MIN_WEEKS_WITH_DATA = 3;
const CHART_HEIGHT_CLASS = 'h-36';
// Tokens de cor do tema (nada de hex): violeta = foco, neutro = nota.
const FOCUS_COLOR = 'var(--color-violet-400)';
const GRADE_COLOR = 'var(--color-neutral-300)';
const GRID_COLOR = 'var(--color-neutral-800)';
const AXIS_COLOR = 'var(--color-neutral-500)';
const AXIS_TICKS = [0, 50, 100];

interface ChartPoint {
  label: string;
  // Os dois em 0..100 para partilharem o eixo; os valores reais vao no tooltip.
  focusPercent: number | null;
  gradePercent: number | null;
  avgFocus: number | null;
  gradedTasks: number;
}

const focusToPercent = (focus: number) =>
  ((focus - RATING_MIN) / (RATING_MAX - RATING_MIN)) * FULL_PERCENT;

function toPoints(weeks: FocusTrendWeek[]): ChartPoint[] {
  return weeks.map((week) => ({
    label: week.weekStart.slice(5).split('-').reverse().join('/'),
    focusPercent: week.avgFocus === null ? null : focusToPercent(week.avgFocus),
    gradePercent: week.avgGradePercent,
    avgFocus: week.avgFocus,
    gradedTasks: week.gradedTasks,
  }));
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}

function TrendTooltip({ active, payload }: TooltipProps) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl shadow-violet-950/50">
      <p className="font-medium text-neutral-200">{t('focusTrend.week', { label: point.label })}</p>
      <p className="text-violet-300">
        {point.avgFocus === null
          ? t('focusTrend.noFocus')
          : t('focusTrend.focusValue', { value: point.avgFocus, max: RATING_MAX })}
      </p>
      <p className="text-neutral-300">
        {point.gradePercent === null
          ? t('focusTrend.noGrade')
          : t('focusTrend.gradeValue', { value: point.gradePercent, count: point.gradedTasks })}
      </p>
    </div>
  );
}

// Foco medio por semana ao lado da nota media das tasks dessa semana: ve-se
// a relacao a formar-se antes de haver dados para o modelo concluir.
export default function FocusTrendChart() {
  const { t } = useI18n();
  const { weeks, isLoading, error } = useFocusTrend();
  const points = useMemo(() => toPoints(weeks ?? []), [weeks]);

  const weeksWithData = points.filter((p) => p.focusPercent !== null || p.gradePercent !== null).length;
  if (isLoading || error || weeksWithData < MIN_WEEKS_WITH_DATA) return null;

  return (
    <div className="mt-4">
      <p className="mb-1 text-xs text-neutral-500">{t('focusTrend.title')}</p>
      <div className={CHART_HEIGHT_CLASS}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, FULL_PERCENT]} ticks={AXIS_TICKS} tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} />
            <Tooltip content={<TrendTooltip />} />
            <Line type="monotone" dataKey="focusPercent" stroke={FOCUS_COLOR} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            <Line type="monotone" dataKey="gradePercent" stroke={GRADE_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex gap-4 text-[10px] text-neutral-500">
        <LegendItem dotClassName="bg-violet-400">{t('focusTrend.legendFocus')}</LegendItem>
        <LegendItem dotClassName="bg-neutral-300">{t('focusTrend.legendGrade')}</LegendItem>
      </div>
    </div>
  );
}
