import type { ProgressStatus } from '../../types/models';

interface StatusBadgeProps {
  status: ProgressStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    ADIANTADO: 'bg-green-900/50 text-green-400 border-green-800',
    TEMPO_ESPERADO: 'bg-blue-900/50 text-blue-400 border-blue-800',
    ATRASADO: 'bg-orange-900/50 text-orange-400 border-orange-800',
    MUITO_ATRASADO: 'bg-red-900/50 text-red-400 border-red-800',
  };

  const labels = {
    ADIANTADO: 'Adiantado',
    TEMPO_ESPERADO: 'No Tempo',
    ATRASADO: 'Atrasado',
    MUITO_ATRASADO: 'Muito Atrasado'
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}