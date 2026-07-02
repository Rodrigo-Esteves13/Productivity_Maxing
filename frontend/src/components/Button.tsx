import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-violet-700 text-white hover:bg-violet-600',
  secondary: 'border border-neutral-700 text-neutral-200 hover:border-neutral-500',
};

export default function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded p-2 transition-colors ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
}