interface CountBadgeProps {
  count: number;
  /** Texto para leitores de ecra ("3 a espera de resposta"). */
  label: string;
  className?: string;
}

const MAX_SHOWN = 9;

// Numero pequeno ao lado de um link (pedidos/convites pendentes). Zero nao
// mostra nada.
export default function CountBadge({ count, label, className = '' }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      title={label}
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold leading-none tabular-nums text-white ${className}`}
    >
      <span aria-hidden="true">{count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
