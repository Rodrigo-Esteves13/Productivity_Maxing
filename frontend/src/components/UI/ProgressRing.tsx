import type { ReactNode } from 'react';

interface ProgressRingProps {
  // 0 a 100; valores fora do intervalo ficam presos aos limites.
  percent: number;
  size?: number;
  strokeWidth?: number;
  // Classe de cor do traco (ex: 'text-violet-500'); usa currentColor.
  colorClassName?: string;
  label: string;
  children?: ReactNode;
}

// Anel de progresso (o resto da app usa barras; o anel serve para um numero
// grande no centro, como o estudo de hoje).
export default function ProgressRing({
  percent,
  size = 104,
  strokeWidth = 9,
  colorClassName = 'text-violet-500',
  label,
  children,
}: ProgressRingProps) {
  const value = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-neutral-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={`stroke-current ${colorClassName}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  );
}
