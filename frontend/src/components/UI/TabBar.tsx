import CountBadge from './CountBadge';

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
// horizontal em vez de partir em varias linhas.
export default function TabBar<T extends string>({ items, value, onChange, label, className = '' }: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-800 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-violet-500 text-white'
                : 'border-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            {item.label}
            {item.alert ? (
              <CountBadge count={item.alert} label={item.alertLabel ?? String(item.alert)} />
            ) : item.count ? (
              <span className="text-xs text-neutral-500">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
