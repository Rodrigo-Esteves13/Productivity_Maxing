import type { ReactNode } from 'react';

interface LegendItemProps {
  // Classe de fundo do ponto (ex: 'bg-violet-500'), igual a da barra/serie.
  dotClassName: string;
  children: ReactNode;
}

// Linha de legenda de graficos: ponto de cor + texto.
export default function LegendItem({ dotClassName, children }: LegendItemProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${dotClassName}`} />
      {children}
    </span>
  );
}
