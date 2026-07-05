import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Select({ label, id, className = '', ...rest }: SelectProps) {
  // `appearance-none` remove a seta nativa do browser — com `color-scheme: dark`
  // definido globalmente, alguns browsers (Chrome/Edge) desenham o <select> com
  // um "theme" escuro próprio que inclui a sua própria seta, o que resultava em
  // duas setas sobrepostas/coladas ao texto. Desenhamos a nossa própria seta em
  // SVG para teres controlo total sobre o visual, igual em todos os browsers.
  const field = (
    <div className="relative">
      <select
        id={id}
        className={`w-full appearance-none border border-neutral-700 bg-neutral-900 text-white rounded-lg pl-3 pr-9 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...rest}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
      >
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
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
