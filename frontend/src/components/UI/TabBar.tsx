import CountBadge from './CountBadge';
import { useActiveIndicator } from '../../hooks/useActiveIndicator';

export interface TabBarItem<T extends string> {
  value: T;
  label: string;
  /** Numero discreto ao lado ("Amigos 4"). */
  count?: number;
  /** Numero destacado: coisas a espera de resposta. */
  alert?: number;
  alertLabel?: string;
}

interface TabBarProps<T extends string> {
  items: TabBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

// Separadores de uma pagina (role=tablist). Em ecras estreitos desliza na
// horizontal em vez de partir em varias linhas. O sublinhado do separador
// ativo desliza entre separadores.
export default function TabBar<T extends string>({ items, value, onChange, label, className = '' }: TabBarProps<T>) {
  const { containerRef, rect } = useActiveIndicator<HTMLDivElement>(value);
  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={label}
      className={`relative -mx-4 flex gap-1 overflow-x-auto border-b border-neutral-800 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(item.value)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? `text-white ${rect ? 'border-transparent' : 'border-violet-500'}`
                : 'border-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            {item.label}
            {item.alert ? (
              <CountBadge count={item.alert} label={item.alertLabel ?? String(item.alert)} />
            ) : item.count ? (
              <span className="text-xs tabular-nums text-neutral-500">{item.count}</span>
            ) : null}
          </button>
        );
      })}
      {rect && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-violet-500 transition-[translate,width] duration-[var(--duration-fast)] ease-smooth-out"
          style={{ width: rect.width, translate: `${rect.x}px 0` }}
        />
      )}
    </div>
  );
}
