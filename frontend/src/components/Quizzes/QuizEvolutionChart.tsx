import { useRef } from 'react';
import { CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ExportChartButton from '../UI/ExportChartButton';
import LegendItem from '../UI/LegendItem';
import { useI18n } from '../../i18n/useI18n';
import { PERCENT, QUIZ_PASS_PERCENT, type EvolutionPoint } from '../../lib/quizInsights';
import { CHART_COLORS } from '../../lib/chartColors';

const EXPORT_FILENAME_SLUG = 'quiz-evolution';
const EXAM_COLOR = CHART_COLORS.accent;
const OTHER_COLOR = CHART_COLORS.muted;
const PASS_COLOR = CHART_COLORS.threshold;
const DOT_RADIUS = 4;
const MIN_POINTS = 2;

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: EvolutionPoint;
}

function PointDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined) return null;
  const color = payload?.exam ? EXAM_COLOR : OTHER_COLOR;
  return <Dot cx={cx} cy={cy} r={DOT_RADIUS} fill={color} stroke={CHART_COLORS.surface} strokeWidth={2} />;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: EvolutionPoint }[] }) {
  const { t, lang } = useI18n();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl">
      <p className="font-semibold text-violet-300 tabular-nums">{point.percent}%</p>
      <p className="text-neutral-400">{point.exam ? t('quizzes.mode.exam') : t('quizzes.stats.evolutionOther')}</p>
      <p className="text-neutral-500">{new Date(point.at).toLocaleString(lang)}</p>
    </div>
  );
}

// Evolucao das ultimas tentativas, com a linha da nota de referencia.
export default function QuizEvolutionChart({ points }: { points: EvolutionPoint[] }) {
  const { t } = useI18n();
  const chartRef = useRef<HTMLDivElement>(null);
  if (points.length < MIN_POINTS) return <p className="text-sm text-neutral-400">{t('quizzes.stats.evolutionEmpty')}</p>;
  const data = points.map((p, i) => ({ ...p, n: i + 1 }));
  return (
    <div>
      <div ref={chartRef} className="relative h-56 w-full">
        <ExportChartButton containerRef={chartRef} filenameSlug={EXPORT_FILENAME_SLUG} className="absolute right-0 top-0 z-10" />
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="n" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.axis }} tickLine={false} />
            <YAxis domain={[0, PERCENT]} tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <ReferenceLine y={QUIZ_PASS_PERCENT} stroke={PASS_COLOR} strokeDasharray="4 4" strokeOpacity={0.7} />
            <Tooltip content={<PointTooltip />} cursor={{ stroke: EXAM_COLOR, strokeOpacity: 0.4 }} />
            <Line type="monotone" dataKey="percent" stroke={EXAM_COLOR} strokeWidth={2} dot={(props: DotProps) => <PointDot {...props} key={props.payload?.at} />} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-400">
        <LegendItem dotClassName="bg-violet-400">{t('quizzes.mode.exam')}</LegendItem>
        <LegendItem dotClassName="bg-neutral-500">{t('quizzes.stats.evolutionOther')}</LegendItem>
        <LegendItem dotClassName="bg-amber-400">{t('quizzes.stats.passLine', { percent: QUIZ_PASS_PERCENT })}</LegendItem>
      </div>
    </div>
  );
}
