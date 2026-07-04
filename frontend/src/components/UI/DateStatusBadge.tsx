import type { DateStatus } from '../../utils/taskDateStatus';

interface DateStatusBadgeProps {
  status: DateStatus;
}

// Esquema de cores escolhido (em vez do amarelo/verde/vermelho sugerido
// originalmente, que invertia a leitura habitual de urgência):
// - Overdue (já passou e não está concluída) -> vermelho: precisa de atenção
// - Due Today -> amber: é hoje, mas ainda não é uma emergência
// - Upcoming (ainda para vir) -> azul neutro: sem urgência
// - Completed -> verde: feito
const CONFIG: Record<DateStatus, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-900/50 text-red-400 border-red-800' },
  today: { label: 'Due Today', className: 'bg-amber-900/50 text-amber-400 border-amber-800' },
  upcoming: { label: 'Upcoming', className: 'bg-sky-900/50 text-sky-300 border-sky-800' },
  completed: { label: 'Completed', className: 'bg-green-900/50 text-green-400 border-green-800' },
};

export default function DateStatusBadge({ status }: DateStatusBadgeProps) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
