import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Select({ label, id, className = '', ...rest }: SelectProps) {
  const field = (
    <select
      id={id}
      className={`border border-neutral-700 bg-neutral-900 text-white rounded p-2 ${className}`}
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
