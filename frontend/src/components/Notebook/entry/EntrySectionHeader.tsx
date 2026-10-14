import type { ComponentType, ReactNode } from 'react';

interface EntrySectionHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  // Acao opcional do lado direito (ex.: "Add file").
  action?: ReactNode;
}

// Cabecalho das secoes da entrada: icone + titulo em minusculas normais
// (nao em CAPS), com a acao da secao alinhada a direita.
export default function EntrySectionHeader({ icon: Icon, title, action }: EntrySectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
        <Icon className="h-4 w-4 text-violet-400" />
        {title}
      </h3>
      {action}
    </div>
  );
}
