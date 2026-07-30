import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Dot,
} from 'recharts';
import type { DotProps } from 'recharts';
import type { PeriodComparisonEntry } from '../../types/models';

interface GpaTrendChartProps {
  entries: PeriodComparisonEntry[];
  scale: string;
  cumulativeAverage?: number | null;
}

// Parses a "0-20" style scale into its numeric floor/ceiling.
function parseScale(scale: string): { min: number; max: number } {
  const [min, max] = scale.split('-').map(Number);
  return Number.isFinite(min) && Number.isFinite(max) && max > min
    ? { min, max }
    : { min: 0, max: 20 };
}

// Grades tend to cluster in a narrow band (e.g. 14-18 on a 0-20 scale), so
// pinning the axis to the full scale makes every trend look almost flat.
// Zoom to the data's own range instead, with headroom, still clamped to the
// scale's bounds so it never overshoots into impossible values.
function computeDomain(values: number[], scaleMin: number, scaleMax: number) {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const spread = dataMax - dataMin;
  const padding = Math.max(spread * 0.4, (scaleMax - scaleMin) * 0.05, 0.5);
  return {
    domainMin: Math.max(scaleMin, Math.floor((dataMin - padding) * 10) / 10),
    domainMax: Math.min(scaleMax, Math.ceil((dataMax + padding) * 10) / 10),
  };
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
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 shadow-2xl shadow-violet-950/50">
      <p className="text-xs font-medium text-neutral-200">{entry.periodName}</p>
      <p className="text-sm font-bold text-violet-300">
        {entry.average?.toFixed(2)}{' '}
        <span className="text-neutral-500 font-normal">/ {scale.split('-')[1] ?? scale}</span>
      </p>
      {entry.isArchived && <p className="text-[10px] text-neutral-500">Archived</p>}
    </div>
  );
}

// Custom dot: hollow ring for archived periods, glowing solid violet for
// the current (last, non-archived) one so it reads as "you are here".
function TrendDot(props: DotProps & { payload?: PeriodComparisonEntry; isLast?: boolean }) {
  const { cx, cy, payload, isLast } = props;
  if (cx === undefined || cy === undefined) return null;
  const archived = payload?.isArchived;

  if (isLast && !archived) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#a78bfa" opacity={0.22}>
          <animate attributeName="r" values="7;13;7" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={5} fill="#c4b5fd" stroke="#171717" strokeWidth={2} />
      </g>
    );
  }

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

// Period-over-period GPA trend. Recharts area chart, zoomed to the data's
// own range (see computeDomain) so real movement is visible instead of a
// near-flat line, a crisp violet drop-shadow on the stroke (feDropShadow,
// not a Gaussian blur merged onto the source - that was making the whole
// line look blurry instead of glowing), a dashed reference line at the
// program's cumulative average, and a pulsing "you are here" dot on the
// latest non-archived period.
// Periods are already ordered by startDate asc (see
// ProgramsService.getPeriodsComparison on the backend); periods without a
// graded task yet (average === null) are dropped, a line can't be drawn
// through a gap.
export default function GpaTrendChart({ entries, scale, cumulativeAverage }: GpaTrendChartProps) {
  const { min: scaleMin, max: scaleMax } = useMemo(() => parseScale(scale), [scale]);

  const data = useMemo(
    () => entries.filter((e) => e.average !== null),
    [entries],
  );

  const { domainMin, domainMax } = useMemo(() => {
    if (data.length < 2) return { domainMin: scaleMin, domainMax: scaleMax };
    return computeDomain(data.map((d) => d.average as number), scaleMin, scaleMax);
  }, [data, scaleMin, scaleMax]);

  if (data.length < 2) return null;

  const lastIndex = data.length - 1;
  const zoomed = domainMin > scaleMin || domainMax < scaleMax;

  return (
    <div className="relative h-72 w-full">
      {/* Soft ambient glow behind the chart, purely decorative */}
      <div className="pointer-events-none absolute inset-x-8 top-4 h-28 rounded-full bg-violet-500/10 blur-3xl" />

      {zoomed && (
        <p className="absolute right-1 top-0 text-[10px] text-neutral-600">
          zoomed to {domainMin}-{domainMax} of {scaleMin}-{scaleMax} scale
        </p>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gpaTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.5} />
              <stop offset="35%" stopColor="#a78bfa" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gpaTrendStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
            {/* Crisp glow: a drop-shadow halo behind the stroke, not a blur
                merged over it - keeps the line itself sharp. */}
            <filter id="gpaTrendGlow" x="-20%" y="-30%" width="140%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#a78bfa" floodOpacity="0.55" />
            </filter>
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
            domain={[domainMin, domainMax]}
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          {cumulativeAverage !== null &&
            cumulativeAverage !== undefined &&
            cumulativeAverage >= domainMin &&
            cumulativeAverage <= domainMax && (
              <ReferenceLine
                y={cumulativeAverage}
                stroke="#737373"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{
                  value: `cumulative ${cumulativeAverage.toFixed(2)}`,
                  position: 'insideBottomRight',
                  fill: '#a3a3a3',
                  fontSize: 10,
                }}
              />
            )}

          <Tooltip
            content={<CustomTooltip scale={scale} />}
            cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeOpacity: 0.4 }}
          />

          <Area
            type="monotone"
            dataKey="average"
            stroke="url(#gpaTrendStroke)"
            strokeWidth={3}
            fill="url(#gpaTrendFill)"
            filter="url(#gpaTrendGlow)"
            dot={(props: any) => (
              <TrendDot key={props.payload?.periodId} {...props} isLast={props.index === lastIndex} />
            )}
            activeDot={{ r: 6, fill: '#c4b5fd', stroke: '#171717', strokeWidth: 2 }}
            animationDuration={900}
            animationEasing="ease-out"
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
