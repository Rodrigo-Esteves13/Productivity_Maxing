import { formatClock } from '../../lib/timeFormat';
import type { AgendaItem } from '../../lib/agenda';

interface WeekDayCellProps {
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  items: AgendaItem[];
}

function AgendaEntry({ item }: { item: AgendaItem }) {
  const time = `${formatClock(item.startMinutes)}-${formatClock(item.endMinutes)}`;

  if (item.kind === 'class') {
    const { subject, location } = item.occurrence;
    return (
      <div className="text-xs bg-neutral-800/60 rounded-md px-2 py-1">
        <p className="text-neutral-200 font-medium leading-tight break-words">{subject}</p>
        <p className="text-neutral-500 leading-tight">
          {time}
          {location ? ` · ${location}` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="text-xs bg-amber-950/30 border border-amber-900/40 rounded-md px-2 py-1">
      <p className="text-amber-200 font-medium leading-tight break-words">{item.occurrence.label ?? 'Commitment'}</p>
      <p className="text-amber-200/60 leading-tight">{time}</p>
    </div>
  );
}

// Um dia da grelha semanal: aulas e turnos misturados por ordem de hora.
export default function WeekDayCell({ label, dayOfMonth, isToday, items }: WeekDayCellProps) {
  return (
    <div
      className={`rounded-lg border p-2 min-h-[6rem] min-w-0 ${
        isToday ? 'border-violet-600/60 bg-violet-950/20' : 'border-neutral-800'
      }`}
    >
      <p className="text-xs font-medium text-neutral-300 mb-2">
        {label} {dayOfMonth}
      </p>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-xs text-neutral-600">-</p>}
        {items.map((item) => (
          <AgendaEntry key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}
