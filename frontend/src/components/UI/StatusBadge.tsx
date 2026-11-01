import type { ProgressStatus } from '../../types/models';
import { useEnumLabel } from '../../hooks/useEnumLabel';

interface StatusBadgeProps {
  status: ProgressStatus;
  // 'sm': para linhas de badges pequenos (Dashboard), onde a pilula grande
  // ficava desproporcionada ao lado de DifficultyBadge/PriorityBadge.
  size?: 'md' | 'sm';
}

const SIZE_STYLE: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  md: 'px-2 py-1 text-xs',
  sm: 'px-2 py-0.5 text-[11px]',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const enumLabel = useEnumLabel();
  const styles: Record<string, string> = {
    NOT_STARTED: 'bg-neutral-800 text-neutral-400 border-neutral-700',
    AHEAD: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
    ON_TRACK: 'bg-violet-900/50 text-violet-300 border-violet-800',
    BEHIND: 'bg-orange-900/50 text-orange-400 border-orange-800',
    VERY_BEHIND: 'bg-red-900/50 text-red-400 border-red-800',
  };

  const currentStyle = styles[status as string] || 'bg-neutral-800 text-neutral-300 border-neutral-700';

  return (
    <span className={`whitespace-nowrap ${SIZE_STYLE[size]} font-semibold rounded-full border ${currentStyle}`}>
      {enumLabel(status)}
    </span>
  );
}
