import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, id, className = '', ...rest }: InputProps) {
  // Most call sites only pass `label`, not `id` (Login.tsx, TaskEditForm,
  // etc.) - without an id, htmlFor below has nothing to point at, so the
  // <label> and <input> are visually together but NOT programmatically
  // associated (screen readers can't tell they're linked, and
  // getByLabel() in tests/accessibility tooling can't find the field
  // either). useId() gives every Input a stable id for free when the
  // caller doesn't supply one, without requiring every call site to be
  // touched.
  const generatedId = useId();
  const resolvedId = id ?? generatedId;

  const field = (
    <input
      id={resolvedId}
      className={`w-full block border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-2.5 text-base placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    />
  );

  if (!label) return field;

  return (
    <div>
      <label htmlFor={resolvedId} className="block text-sm font-medium text-neutral-300 mb-1">
        {label}
      </label>
      {field}
    </div>
  );
}
