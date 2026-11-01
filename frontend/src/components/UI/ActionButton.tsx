import type { ButtonHTMLAttributes } from 'react';

type ActionButtonColor = 'violet' | 'amber';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ActionButtonColor;
}

const colorClasses: Record<ActionButtonColor, string> = {
  violet: 'bg-violet-700 hover:bg-violet-600',
  amber: 'bg-amber-700 hover:bg-amber-800',
};

export default function ActionButton({ color = 'violet', className = '', ...rest }: ActionButtonProps) {
  return (
    <button
      className={`press px-4 py-2 text-white text-sm font-medium rounded-lg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${colorClasses[color]} ${className}`}
      {...rest}
    />
  );
}
