import { UndoIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

interface PostponedIndicatorProps {
  count: number;
  className?: string;
}

// Deliberately silent below 2 - a task rescheduled once is just normal
// planning, not a pattern worth flagging. This only exists to surface
// genuine procrastination (3+, 5+ times), not to nag about every routine
// "actually let's do this tomorrow instead."
const MIN_COUNT_TO_SHOW = 2;

export default function PostponedIndicator({ count, className = '' }: PostponedIndicatorProps) {
  const { t } = useI18n();
  if (count < MIN_COUNT_TO_SHOW) return null;

  return (
    <span
      title={t('ui.postponedNTimes', { count })}
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-amber-500/80 ${className}`}
    >
      <UndoIcon className="w-3 h-3" />
      {count}x
    </span>
  );
}
