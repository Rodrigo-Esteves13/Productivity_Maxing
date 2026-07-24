import { useMemo } from 'react';
import type { PeriodComparisonEntry } from '../../types/models';

interface GpaTrendChartProps {
  entries: PeriodComparisonEntry[];
  scale: string;
}

const WIDTH = 600;
const HEIGHT = 140;
const PADDING_X = 28;
const PADDING_Y = 16;

// Parses a "0-20" style scale into its numeric ceiling, for the chart's
// y-axis. Falls back to a sane default if the format is ever different.
function scaleMax(scale: string): number {
  const parts = scale.split('-').map(Number);
  const max = parts[1];
  return Number.isFinite(max) && max > 0 ? max : 20;
}

// Small dependency-free SVG line chart - avoids pulling in a charting
// library just for this one widget. Periods are already ordered by
// startDate asc (see ProgramsService.getPeriodsComparison on the
// backend); periods without a graded task yet (average === null) are
// skipped, a line can't be drawn through a gap.
export default function GpaTrendChart({ entries, scale }: GpaTrendChartProps) {
  // All hooks run unconditionally, before the "not enough data" early
  // return below - conditional returns can only happen after every hook
  // call, per the rules of hooks.
  const graded = useMemo(
    () =>
      entries.filter(
        (e): e is PeriodComparisonEntry & { average: number } => e.average !== null,
      ),
    [entries],
  );

  const { points, linePath, areaPath } = useMemo(() => {
    const max = scaleMax(scale);
    const usableWidth = WIDTH - PADDING_X * 2;
    const usableHeight = HEIGHT - PADDING_Y * 2;

    const pts = graded.map((entry, index) => {
      const x = PADDING_X + (index / Math.max(graded.length - 1, 1)) * usableWidth;
      const clamped = Math.min(Math.max(entry.average, 0), max);
      const y = PADDING_Y + usableHeight - (clamped / max) * usableHeight;
      return { x, y, entry };
    });

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area =
      pts.length > 0
        ? `${line} L ${pts[pts.length - 1].x} ${HEIGHT - PADDING_Y} L ${pts[0].x} ${HEIGHT - PADDING_Y} Z`
        : '';

    return { points: pts, linePath: line, areaPath: area };
  }, [graded, scale]);

  if (graded.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-32"
      preserveAspectRatio="none"
      role="img"
      aria-label="GPA trend across periods"
    >
      <path d={areaPath} fill="url(#gpa-trend-gradient)" opacity={0.25} />
      <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={p.entry.periodId}>
          <circle
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={p.entry.isArchived ? '#737373' : '#a78bfa'}
          />
          <text
            x={p.x}
            y={HEIGHT - 2}
            fontSize={9}
            fill="#737373"
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          >
            {p.entry.periodName.length > 12
              ? `${p.entry.periodName.slice(0, 11)}…`
              : p.entry.periodName}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="gpa-trend-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}
