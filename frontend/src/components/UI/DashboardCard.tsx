import type { ReactNode } from 'react';

export type CardTone = 'neutral' | 'warning' | 'danger';

const BORDER_CLASS: Record<CardTone, string> = {
  neutral: 'border-neutral-800',
  warning: 'border-amber-900/50',
  danger: 'border-red-900/50',
};

const HEADING_CLASS: Record<CardTone, string> = {
  neutral: 'text-neutral-500',
  warning: 'text-amber-400',
  danger: 'text-red-400',
};

interface DashboardCardProps {
  tone?: CardTone;
  // Cartao em coluna flex para o <CardBody> poder ocupar (e centrar o
  // conteudo no) espaco que sobra quando o MasonryGrid estica o cartao.
  fillBody?: boolean;
  // Margens e extras de layout (ex: 'mb-6'); o resto vem do componente.
  className?: string;
  children: ReactNode;
}

// Casca unica dos cartoes do Dashboard: fundo, borda, cantos e sombra.
export default function DashboardCard({ tone = 'neutral', fillBody = false, className = '', children }: DashboardCardProps) {
  return (
    <div
      className={`bg-neutral-900/50 border ${BORDER_CLASS[tone]} rounded-xl p-4 shadow-xl ${fillBody ? 'flex flex-col' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeadingProps {
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}

// Titulo pequeno em maiusculas no topo de um cartao (aceita um icone).
export function CardHeading({ tone = 'neutral', className = '', children }: CardHeadingProps) {
  return (
    <p className={`text-xs uppercase tracking-wide ${HEADING_CLASS[tone]} flex items-center gap-1.5 ${className}`}>
      {children}
    </p>
  );
}

// Corpo de um cartao com graficos: ocupa o que sobra do cartao e centra o
// conteudo na vertical, em vez de o deixar colado ao topo com um vazio por
// baixo. So faz efeito em cartoes com fillBody.
export function CardBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`flex flex-1 flex-col justify-center ${className}`}>{children}</div>;
}
