import type { ReactNode } from 'react';

// Cabecalho de seccao que fica preso por baixo da navbar (h-16) ao fazer scroll.
export default function SectionHeader({ heading, actions }: { heading: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sticky top-16 z-10 -mx-1 mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3 bg-neutral-950 px-1 py-1">
      {heading}
      {actions && <div className="flex flex-wrap items-center gap-x-2">{actions}</div>}
    </div>
  );
}
