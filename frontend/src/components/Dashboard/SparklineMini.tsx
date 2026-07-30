import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineMiniProps {
  data: { value: number | null }[];
  color?: string;
  className?: string;
}

// Tiny trend indicator for stat cards - no axes, no tooltip, just shape.
// Renders null below 2 points since a single dot can't show a trend.
export default function SparklineMini({
  data,
  color = '#a78bfa',
  className = 'h-8 w-20',
}: SparklineMiniProps) {
  const points = data.filter((d): d is { value: number } => d.value !== null);
  if (points.length < 2) return null;

  const gradientId = `sparkline-${color.replace('#', '')}`;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
