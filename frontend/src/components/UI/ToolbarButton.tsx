import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ToolbarButtonTone = 'neutral' | 'muted' | 'danger';
type ToolbarButtonSize = 'sm' | 'md';

interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  tone?: ToolbarButtonTone;
  // 'sm': barras compactas (canvas do Notebook); 'md': acoes no topo de uma
  // pagina (Import, CSV, Print... no Dashboard).
  size?: ToolbarButtonSize;
  // Quando definido, o botao e um interruptor (aria-pressed) e fica violeta ligado.
  pressed?: boolean;
  children: ReactNode;
}

const TONE_CLASS: Record<ToolbarButtonTone, string> = {
  neutral: 'text-neutral-300',
  muted: 'text-neutral-400 hover:text-neutral-200',
  danger: 'text-red-400',
};

const SIZE_CLASS: Record<ToolbarButtonSize, string> = {
  sm: 'gap-1 px-2 py-1 text-xs',
  md: 'gap-1.5 px-2.5 py-1.5 text-sm',
};

// Ligado: solido nas barras compactas, discreto nas acoes de pagina.
const PRESSED_CLASS: Record<ToolbarButtonSize, string> = {
  sm: 'bg-violet-600 text-white',
  md: 'bg-violet-500/15 text-violet-200',
};

// Botao de barra de ferramentas (icone + texto). Repetia-se em dez sitios
// do canvas do Notebook e nas acoes do Dashboard com a mesma lista de classes.
export default function ToolbarButton({
  tone = 'neutral',
  size = 'sm',
  pressed,
  className = '',
  type = 'button',
  children,
  ...rest
}: ToolbarButtonProps) {
  const stateClass = pressed ? PRESSED_CLASS[size] : `${TONE_CLASS[tone]} hover:bg-neutral-800`;

  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`press flex items-center rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-40 ${SIZE_CLASS[size]} ${stateClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
