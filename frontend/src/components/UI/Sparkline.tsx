interface SparklineProps {
  // Chronological order (oldest first) - same order tasks are sorted in
  // everywhere else in the app (see AreaBreakdownCard).
  values: number[];
  // Scale ceiling to normalize against (e.g. the program's gradeScale max)
  // - without this, a sparkline for someone consistently scoring 18-20
  // would look just as "jumpy" as one for 8-10, since both would stretch
  // to fill the same pixel height.
  max: number;
  width?: number;
  height?: number;
  className?: string;
}

// Deliberately tiny and dependency-free (no charting library) - this is
// just "is the trend up or down at a glance" next to a course name, not a
// real chart; GpaTrendChart already covers the detailed view.
export default function Sparkline({ values, max, width = 56, height = 18, className }: SparklineProps) {
  if (values.length < 2) return null;

  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      const clamped = Math.min(Math.max(value, 0), max);
      const y = height - (clamped / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const trendUp = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`${trendUp ? 'text-emerald-400' : 'text-red-400'} ${className ?? ''}`}
      aria-hidden="true"
    >
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
