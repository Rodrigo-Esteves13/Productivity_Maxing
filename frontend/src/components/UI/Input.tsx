import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, id, className = '', ...rest }: InputProps) {
  const field = (
    <input
      id={id}
      className={`w-full block border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-2.5 text-base placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    />
  );

  if (!label) return field;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">
        {label}
      </label>
      {field}
    </div>
  );
}
