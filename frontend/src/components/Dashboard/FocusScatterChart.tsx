import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useFocusScatter } from '../../hooks/useFocusScatter';
import { useI18n } from '../../i18n/useI18n';
import { FULL_PERCENT } from '../../lib/percent';
import { RATING_MAX, RATING_MIN, RATING_VALUES } from '../../lib/rating';
import type { FocusScatterPoint } from '../../types/models';

// Poucas bolinhas nao mostram nada: espera por algumas tasks.
const MIN_POINTS = 4;
const CHART_HEIGHT_CLASS = 'h-40';
const POINT_COLOR = 'var(--color-violet-400)';
const GRID_COLOR = 'var(--color-neutral-800)';
const AXIS_COLOR = 'var(--color-neutral-500)';
const AXIS_TICKS = [0, 50, 100];
// Folga nos lados do eixo do foco para as bolinhas dos extremos nao cortarem.
const FOCUS_AXIS_PADDING = 0.3;

interface TooltipProps {
  active?: boolean;
  payload?: { payload: FocusScatterPoint }[];
}

function PointTooltip({ active, payload }: TooltipProps) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-56 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl shadow-violet-950/50">
      <p className="truncate font-medium text-neutral-200">{point.title}</p>
      <p className="text-neutral-500">{point.areaName} - {point.date}</p>
      <p className="text-violet-300">{t('focusTrend.focusValue', { value: point.avgFocus, max: RATING_MAX })}</p>
      <p className="text-neutral-300">{t('focusScatter.grade', { value: point.gradePercent })}</p>
    </div>
  );
}

// Uma bolinha por task avaliada: foco medio das sessoes nos dias antes do
// prazo (X) contra a nota (Y). Ancora o estudo a cada teste, ao contrario
// do grafico semanal que mistura semanas.
export default function FocusScatterChart() {
  const { t } = useI18n();
  const { points, isLoading, error } = useFocusScatter();

  if (isLoading || error || !points || points.length < MIN_POINTS) return null;

  return (
    <div className="mt-4">
      <p className="mb-1 text-xs text-neutral-500">{t('focusScatter.title')}</p>
      <div className={CHART_HEIGHT_CLASS}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={GRID_COLOR} />
            <XAxis
              type="number"
              dataKey="avgFocus"
              name={t('focusScatter.axisFocus')}
              domain={[RATING_MIN - FOCUS_AXIS_PADDING, RATING_MAX + FOCUS_AXIS_PADDING]}
              ticks={RATING_VALUES}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="gradePercent"
              name={t('focusScatter.axisGrade')}
              domain={[0, FULL_PERCENT]}
              ticks={AXIS_TICKS}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<PointTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={points} fill={POINT_COLOR} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-neutral-500">{t('focusScatter.legend', { count: points.length })}</p>
    </div>
  );
}
