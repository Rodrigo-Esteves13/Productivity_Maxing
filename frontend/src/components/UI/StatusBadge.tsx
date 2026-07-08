import type { ProgressStatus } from '../../types/models';
import { formatEnumLabel } from '../../utils/formatEnumLabel';

interface StatusBadgeProps {
  status: ProgressStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    AHEAD: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
    ON_TRACK: 'bg-violet-900/50 text-violet-300 border-violet-800',
    BEHIND: 'bg-orange-900/50 text-orange-400 border-orange-800',
    VERY_BEHIND: 'bg-red-900/50 text-red-400 border-red-800',
  };

  const currentStyle = styles[status as string] || 'bg-neutral-800 text-neutral-300 border-neutral-700';

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${currentStyle}`}>
      {formatEnumLabel(status)}
    </span>
  );
}
