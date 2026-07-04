type StatusDotColor = 'green' | 'amber' | 'red' | 'neutral';

interface StatusDotProps {
  color?: StatusDotColor;
  pulse?: boolean;
}

const colorClasses: Record<StatusDotColor, string> = {
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  neutral: 'bg-neutral-500',
};

// Um ponto com "halo" a pulsar - usado para indicadores de estado tipo "tudo a funcionar"
export default function StatusDot({ color = 'green', pulse = true }: StatusDotProps) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${colorClasses[color]} opacity-75 animate-ping`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClasses[color]}`} />
    </span>
  );
}
