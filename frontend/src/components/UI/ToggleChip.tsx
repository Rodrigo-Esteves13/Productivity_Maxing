import type { ReactNode } from 'react';

type ToggleChipSize = 'sm' | 'md';

interface ToggleChipProps {
  pressed: boolean;
  onClick: () => void;
  size?: ToggleChipSize;
  className?: string;
  children: ReactNode;
}

const SIZE_CLASS: Record<ToggleChipSize, string> = {
  sm: 'px-2.5',
  md: 'px-3',
};

// Botao-pilula com estado ligado/desligado (dias da semana, modos...).
// aria-pressed diz a leitores de ecra qual esta ativo.
export default function ToggleChip({ pressed, onClick, size = 'md', className = '', children }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${SIZE_CLASS[size]} py-1.5 rounded-lg text-sm border ${
        pressed
          ? 'border-violet-500 bg-violet-600/20 text-white'
          : 'border-neutral-700 text-neutral-400 hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}
