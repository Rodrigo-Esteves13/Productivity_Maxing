import { formatClock } from '../../lib/timeFormat';
import type { AgendaItem } from '../../lib/agenda';
import { AGENDA_TONE_CLASSES, getAgendaTone } from '../../lib/agendaTone';
import { useI18n } from '../../i18n/useI18n';

interface WeekDayCellProps {
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  items: AgendaItem[];
}

function AgendaEntry({ item }: { item: AgendaItem }) {
  const { t } = useI18n();
  const tone = AGENDA_TONE_CLASSES[getAgendaTone(item)];
  const time = `${formatClock(item.startMinutes)}-${formatClock(item.endMinutes)}`;

  if (item.kind === 'class') {
    const { subject, location } = item.occurrence;
    return (
      <div className={`text-xs rounded-md px-2 py-1 ${tone.card}`}>
        <p className={`${tone.title} font-medium leading-tight break-words`}>{subject}</p>
        <p className={`${tone.meta} leading-tight`}>
          {time}
          {location ? ` · ${location}` : ''}
        </p>
      </div>
    );
  }

  const isEvent = getAgendaTone(item) === 'event';
  return (
    <div className={`text-xs rounded-md px-2 py-1 ${tone.card}`}>
      <p className={`${tone.title} font-medium leading-tight break-words`}>
        {item.occurrence.label ?? t(isEvent ? 'schedule.fallback.event' : 'schedule.fallback.work')}
      </p>
      <p className={`${tone.meta} leading-tight`}>{time}</p>
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
