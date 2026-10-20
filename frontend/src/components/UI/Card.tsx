import type { ReactNode } from 'react';

interface CardProps {
  // Margens e layout extra (ex: 'mt-6', 'flex flex-col'); a casca vem daqui.
  className?: string;
  children: ReactNode;
}

const CARD_CLASS = 'bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6';

// Casca comum dos cartoes das paginas (Focus, Schedule, Profile, ...): antes
// eram 20 copias da mesma linha de classes. Os cartoes do Dashboard usam o
// DashboardCard (mais compacto e com sombra).
export default function Card({ className = '', children }: CardProps) {
  return <div className={className ? `${CARD_CLASS} ${className}` : CARD_CLASS}>{children}</div>;
}
