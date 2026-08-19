import { useId, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

// Same shape as Input.tsx, including the useId() fallback for label
// association - see the comment there for why that matters (a bare
// `label` prop with no explicit `id` used to leave the <label> and field
// disconnected).
export default function Textarea({ label, id, className = '', ...rest }: TextareaProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;

  const field = (
    <textarea
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
