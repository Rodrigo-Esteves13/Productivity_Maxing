import type { ComponentType } from 'react';

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
// ferramenta de desenho). Antes havia uma copia em cada um.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  surface = 'raised',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`flex items-center rounded-md border border-neutral-800 ${SURFACE_CLASS[surface]} p-0.5 ${className}`}>
      {options.map(({ value: optionValue, label, icon: Icon, title }) => (
        <button
          key={optionValue}
          type="button"
          title={title}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
          className={`flex items-center gap-1.5 rounded ${SIZE_CLASS[size]} text-xs font-medium transition-colors ${
            value === optionValue ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
