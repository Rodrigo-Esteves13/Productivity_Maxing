import type { ReactNode } from 'react';

interface DetailRowProps {
  label: string;
  children: ReactNode;
}

export default function DetailRow({ label, children }: DetailRowProps) {
  return (
    // O first:pt-0 remove o padding do topo apenas no primeiro item para alinhar com o header!
    <div className="flex flex-col gap-0.5 py-3 border-b border-neutral-800 last:border-b-0 first:pt-0">
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm text-neutral-200">{children}</div>
    </div>
  );
}
