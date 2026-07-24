import type { DateStatus } from '../../utils/taskDateStatus';

interface DateStatusBadgeProps {
  status: DateStatus;
}

// Color scheme chosen (instead of the originally suggested
// yellow/green/red, which inverted the usual urgency reading):
// - Overdue (past due and not completed) -> red: needs attention
// - Due Today -> amber: it's today, but not yet an emergency
// - Upcoming (still to come) -> neutral blue: no urgency
// - Completed -> green: done
const CONFIG: Record<DateStatus, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-900/50 text-red-400 border-red-800' },
  today: { label: 'Due Today', className: 'bg-amber-900/50 text-amber-400 border-amber-800' },
  upcoming: { label: 'Upcoming', className: 'bg-sky-900/50 text-sky-300 border-sky-800' },
  completed: { label: 'Completed', className: 'bg-cyan-900/50 text-cyan-400 border-cyan-800' },
};

export default function DateStatusBadge({ status }: DateStatusBadgeProps) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
