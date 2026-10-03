import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonTone = 'neutral' | 'danger';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  // Obrigatorio: um botao so com icone nao tem nome para leitores de ecra.
  label: string;
  tone?: IconButtonTone;
  children: ReactNode;
}

const TONE_CLASS: Record<IconButtonTone, string> = {
  neutral: 'hover:text-white',
  danger: 'hover:text-red-400',
};

export default function IconButton({
  label,
  tone = 'neutral',
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`text-neutral-500 p-1 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50 ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
