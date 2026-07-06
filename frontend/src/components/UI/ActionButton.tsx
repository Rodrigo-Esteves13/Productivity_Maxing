import type { ButtonHTMLAttributes } from 'react';

type ActionButtonColor = 'violet' | 'amber';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ActionButtonColor;
}

const colorClasses: Record<ActionButtonColor, string> = {
  violet: 'bg-violet-600 hover:bg-violet-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
};

export default function ActionButton({ color = 'violet', className = '', ...rest }: ActionButtonProps) {
  return (
    <button
      className={`px-4 py-2 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${colorClasses[color]} ${className}`}
      {...rest}
    />
  );
}
