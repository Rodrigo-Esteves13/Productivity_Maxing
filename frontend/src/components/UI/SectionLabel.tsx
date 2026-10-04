import type { ReactNode } from 'react';

interface SectionLabelProps {
  className?: string;
  children: ReactNode;
}

// Rotulo pequeno em maiusculas no topo de uma seccao ("Notes", "Photos"...).
export default function SectionLabel({ className = '', children }: SectionLabelProps) {
  return (
    <span className={`text-xs font-medium uppercase tracking-wide text-neutral-500 ${className}`}>{children}</span>
  );
}
