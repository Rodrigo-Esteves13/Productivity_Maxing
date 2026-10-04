import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ToolbarButtonTone = 'neutral' | 'danger';

interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  tone?: ToolbarButtonTone;
  // Quando definido, o botao e um interruptor (aria-pressed) e fica azul ligado.
  pressed?: boolean;
  children: ReactNode;
}

const TONE_CLASS: Record<ToolbarButtonTone, string> = {
  neutral: 'text-neutral-300',
  danger: 'text-red-400',
};

// Botao pequeno de barra de ferramentas (icone + texto). Repetia-se em
// dez sitios do canvas do Notebook com a mesma lista de classes.
export default function ToolbarButton({
  tone = 'neutral',
  pressed,
  className = '',
  type = 'button',
  children,
  ...rest
}: ToolbarButtonProps) {
  const stateClass =
    pressed === undefined
      ? `${TONE_CLASS[tone]} hover:bg-neutral-800`
      : pressed
        ? 'bg-blue-600 text-white'
        : `${TONE_CLASS[tone]} hover:bg-neutral-800`;

  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${stateClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
