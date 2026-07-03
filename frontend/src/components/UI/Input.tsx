import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, id, className = '', ...rest }: InputProps) {
  const field = (
    <input
      id={id}
      className={`border border-neutral-700 bg-neutral-900 text-white rounded p-2 placeholder:text-neutral-500 ${className}`}
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
