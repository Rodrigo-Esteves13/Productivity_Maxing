import type { ProgressStatus } from '../../types/task';

const statusColors: Record<ProgressStatus, string> = {
  ADIANTADO: 'bg-green-100 text-green-800',
  TEMPO_ESPERADO: 'bg-yellow-100 text-yellow-800',
  ATRASADO: 'bg-orange-100 text-orange-800',
  MUITO_ATRASADO: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: ProgressStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-1 rounded text-xs ${statusColors[status]}`}>
      {status}
    </span>
  );
}