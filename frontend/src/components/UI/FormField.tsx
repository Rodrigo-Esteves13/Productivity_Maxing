import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export default function FormField({ label, htmlFor, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
