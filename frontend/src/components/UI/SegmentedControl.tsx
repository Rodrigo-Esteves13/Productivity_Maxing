import type { ComponentType } from 'react';
import { useActiveIndicator } from '../../hooks/useActiveIndicator';

type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedControlSize;
  // Fundo do trilho: 'raised' em cima de paineis escuros, 'sunken' dentro de barras ja cinzentas.
  surface?: 'raised' | 'sunken';
  className?: string;
}

const SIZE_CLASS: Record<SegmentedControlSize, string> = {
  sm: 'px-2 py-1',
  md: 'px-2.5 py-1.5',
};

const SURFACE_CLASS = {
  raised: 'bg-neutral-900',
  sunken: 'bg-neutral-950',
} as const;

// Grupo de botoes em que so um esta ativo (tipo de entrada, ordenacao,
// ferramenta de desenho). Antes havia uma copia em cada um. A pilula do
// ativo desliza entre opcoes.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  surface = 'raised',
  className = '',
}: SegmentedControlProps<T>) {
  const { containerRef, rect } = useActiveIndicator<HTMLDivElement>(value);
  return (
    <div
      ref={containerRef}
      className={`relative flex items-center rounded-md border border-neutral-800 ${SURFACE_CLASS[surface]} p-0.5 ${className}`}
    >
      {rect && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 left-0 rounded bg-violet-600 transition-[translate,width] duration-[var(--duration-fast)] ease-smooth-out"
          style={{ width: rect.width, translate: `${rect.x}px 0` }}
        />
      )}
      {options.map(({ value: optionValue, label, icon: Icon, title }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            title={title}
            aria-pressed={active}
            data-active={active}
            onClick={() => onChange(optionValue)}
            className={`press relative flex items-center gap-1.5 rounded ${SIZE_CLASS[size]} text-xs font-medium ${
              active ? `text-white ${rect ? '' : 'bg-violet-600'}` : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
