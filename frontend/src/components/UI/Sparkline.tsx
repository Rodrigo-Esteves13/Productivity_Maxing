import { useId } from 'react';

interface SparklineProps {
  // Chronological order (oldest first) - same order tasks are sorted in
  // everywhere else in the app (see AreaBreakdownCard).
  values: number[];
  // Scale ceiling to normalize against (e.g. the program's gradeScale max)
  // - without this, a sparkline for someone consistently scoring 18-20
  // would look just as "jumpy" as one for 8-10, since both would stretch
  // to fill the same pixel height. Defaults to the largest value.
  max?: number;
  width?: number;
  height?: number;
  // Fixed colour via a Tailwind text-* class (the line uses currentColor).
  // Without it the colour follows the trend (up/down).
  colorClassName?: string;
  // Soft gradient under the line (stat cards); plain line otherwise.
  filled?: boolean;
  className?: string;
}

// Deliberately tiny and dependency-free (no charting library) - this is
// just "is the trend up or down at a glance", not a real chart;
// GpaTrendChart already covers the detailed view. Also replaces the old
// recharts-based SparklineMini, so the Dashboard's first paint no longer
// needs the charting chunk just for these.
export default function Sparkline({
  values,
  max,
  width = 56,
  height = 18,
  colorClassName,
  filled = false,
  className,
}: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) return null;

  const ceiling = max ?? Math.max(...values);
  const safeCeiling = ceiling > 0 ? ceiling : 1;
  const coords = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const clamped = Math.min(Math.max(value, 0), safeCeiling);
    const y = height - (clamped / safeCeiling) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const points = coords.join(' ');

  const trendUp = values[values.length - 1] >= values[0];
  const colour = colorClassName ?? (trendUp ? 'text-violet-400' : 'text-red-400');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`${colour} ${className ?? ''}`}
      aria-hidden="true"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
