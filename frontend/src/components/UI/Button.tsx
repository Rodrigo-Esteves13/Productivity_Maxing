import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
// Sem size fica o padding base (p-2, o tamanho de formulario); 'sm' para
// barras e prompts, 'lg' para chamadas a acao em paginas soltas.
type ButtonSize = 'sm' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-violet-700 text-white hover:bg-violet-600',
  secondary: 'border border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800/60',
  danger: 'bg-red-700 text-white hover:bg-red-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({ variant = 'primary', size, className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`press rounded-lg p-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${size ? sizeClasses[size] : ''} ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
}
