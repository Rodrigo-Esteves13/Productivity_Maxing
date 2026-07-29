import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Dot,
} from 'recharts';
import type { DotProps } from 'recharts';
import type { PeriodComparisonEntry } from '../../types/models';

interface GpaTrendChartProps {
  entries: PeriodComparisonEntry[];
  scale: string;
}

// Parses a "0-20" style scale into its numeric floor/ceiling, for the
// chart's y-axis. Falls back to a sane default if the format is ever
// different.
function parseScale(scale: string): { min: number; max: number } {
  const [min, max] = scale.split('-').map(Number);
  return Number.isFinite(min) && Number.isFinite(max) && max > min
    ? { min, max }
    : { min: 0, max: 20 };
}

function CustomTooltip({
  active,
  payload,
  scale,
}: {
  active?: boolean;
  payload?: { payload: PeriodComparisonEntry }[];
  scale: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-neutral-200">{entry.periodName}</p>
      <p className="text-sm font-bold text-violet-400">
        {entry.average?.toFixed(2)} <span className="text-neutral-500 font-normal">/ {scale.split('-')[1] ?? scale}</span>
      </p>
      {entry.isArchived && <p className="text-[10px] text-neutral-500">Archived</p>}
    </div>
  );
}

// Custom dot: hollow ring for archived periods, solid violet for the active
// one - active/currently-tracked period stands out at a glance.
function TrendDot(props: DotProps & { payload?: PeriodComparisonEntry }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  const archived = payload?.isArchived;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      fill={archived ? '#171717' : '#a78bfa'}
      stroke="#a78bfa"
      strokeWidth={2}
    />
  );
}

// Period-over-period GPA trend, rendered with Recharts (gradient area fill,
// animated draw-in, themed tooltip) instead of a hand-rolled SVG.
// Periods are already ordered by startDate asc (see
// ProgramsService.getPeriodsComparison on the backend); periods without a
// graded task yet (average === null) are dropped, a line can't be drawn
// through a gap.
export default function GpaTrendChart({ entries, scale }: GpaTrendChartProps) {
  const { min, max } = useMemo(() => parseScale(scale), [scale]);

  const data = useMemo(
    () => entries.filter((e) => e.average !== null),
    [entries],
  );

  if (data.length < 2) return null;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gpaTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="periodName"
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={{ stroke: '#404040' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <Tooltip
            content={<CustomTooltip scale={scale} />}
            cursor={{ stroke: '#a78bfa', strokeDasharray: '3 3', strokeOpacity: 0.5 }}
          />

          <Area
            type="monotone"
            dataKey="average"
            stroke="#a78bfa"
            strokeWidth={2.5}
            fill="url(#gpaTrendFill)"
            dot={<TrendDot />}
            activeDot={{ r: 6, fill: '#a78bfa', stroke: '#171717', strokeWidth: 2 }}
            animationDuration={600}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
