import { Link } from 'react-router-dom';
import { formatClock } from '../../lib/timeFormat';
import type { AgendaItem } from '../../lib/agenda';
import { AGENDA_TONE_CLASSES, getAgendaTone } from '../../lib/agendaTone';
import { MONTH_CHIP_TONE_CLASSES, type DeadlineChip } from '../../lib/monthAgenda';
import { GraduationCapIcon } from '../UI/Icons';
import type { ClassOccurrence } from '../../types/models';
import AttendanceToggle from './AttendanceToggle';
import { useI18n } from '../../i18n/useI18n';

interface WeekDayCellProps {
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  deadlines: DeadlineChip[];
  items: AgendaItem[];
  // Aulas que ja comecaram ate este minuto do dia podem ter presenca:
  // Infinity num dia passado, a hora atual hoje, null num dia futuro.
  markableUntilMinutes?: number | null;
  onAttendanceChange?: (occurrence: ClassOccurrence, attended: boolean | null) => void;
}

interface AgendaEntryProps {
  item: AgendaItem;
  markableUntilMinutes: number | null;
  onAttendanceChange?: WeekDayCellProps['onAttendanceChange'];
}

// Prazo de uma task, com as mesmas cores da vista mensal (exames a cheio).
// Abre a task na pagina Tasks, como o olho do Dashboard.
function DeadlineEntry({ chip }: { chip: DeadlineChip }) {
  const { t } = useI18n();
  const title = chip.label ?? '';
  return (
    <Link
      to={`/tasks?open=${encodeURIComponent(chip.taskId)}`}
      title={t('common.openTaskNamed', { title })}
      className={`flex items-start gap-1 text-xs rounded-md px-2 py-1 transition-colors hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        MONTH_CHIP_TONE_CLASSES[chip.tone].chip
      }`}
    >
      {chip.tone === 'exam' && <GraduationCapIcon aria-hidden className="mt-px h-3 w-3 shrink-0" />}
      {/* 3 linhas no maximo: o titulo inteiro fica no title do link. */}
      <span className={`min-w-0 font-medium leading-tight break-words line-clamp-3 ${chip.done ? 'line-through opacity-60' : ''}`}>
        {title}
      </span>
    </Link>
  );
}

function AgendaEntry({ item, markableUntilMinutes, onAttendanceChange }: AgendaEntryProps) {
  const { t } = useI18n();
  const tone = AGENDA_TONE_CLASSES[getAgendaTone(item)];
  const time = `${formatClock(item.startMinutes)}-${formatClock(item.endMinutes)}`;

  if (item.kind === 'class') {
    const { subject, location } = item.occurrence;
    const canMark =
      Boolean(onAttendanceChange) &&
      markableUntilMinutes !== null &&
      item.startMinutes <= markableUntilMinutes;
    return (
      <div className={`text-xs rounded-md px-2 py-1.5 ${tone.card} ${item.occurrence.attended === false ? 'opacity-60' : ''}`}>
        {/* 2 linhas no maximo, com hifenizacao: nomes de cadeiras longos
            partiam letra a letra. O nome inteiro fica no title. */}
        <p title={subject} className={`${tone.title} font-medium leading-snug hyphens-auto line-clamp-2`}>
          {subject}
        </p>
        <p className={`${tone.meta} mt-0.5 leading-tight tabular-nums`}>
          {time}
          {location ? ` · ${location}` : ''}
        </p>
        {canMark && (
          <AttendanceToggle
            subject={subject}
            attended={item.occurrence.attended}
            onChange={(attended) => onAttendanceChange?.(item.occurrence, attended)}
          />
        )}
      </div>
    );
  }

  const isEvent = getAgendaTone(item) === 'event';
  return (
    <div className={`text-xs rounded-md px-2 py-1.5 ${tone.card}`}>
      <p className={`${tone.title} font-medium leading-snug hyphens-auto line-clamp-2`}>
        {item.occurrence.label ?? t(isEvent ? 'schedule.fallback.event' : 'schedule.fallback.work')}
      </p>
      <p className={`${tone.meta} mt-0.5 leading-tight tabular-nums`}>{time}</p>
    </div>
  );
}

// Um dia da grelha semanal: prazos primeiro, depois aulas e turnos
// misturados por ordem de hora.
export default function WeekDayCell({
  label,
  dayOfMonth,
  isToday,
  deadlines,
  items,
  markableUntilMinutes = null,
  onAttendanceChange,
}: WeekDayCellProps) {
  return (
    <div
      className={`rounded-lg border p-2 min-h-[8rem] min-w-0 ${
        isToday ? 'border-violet-600/60 bg-violet-950/20' : 'border-neutral-800 bg-neutral-950/30'
      }`}
    >
      {/* Dia da semana pequeno, numero em destaque (pilula violeta hoje). */}
      <p className="mb-2 flex items-center justify-between gap-1 px-0.5">
        <span className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-violet-300' : 'text-neutral-500'}`}>
          {label}
        </span>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums ${
            isToday ? 'bg-violet-600 text-white' : 'text-neutral-200'
          }`}
        >
          {dayOfMonth}
        </span>
      </p>
      <div className="space-y-1.5">
        {deadlines.map((chip) => (
          <DeadlineEntry key={chip.id} chip={chip} />
        ))}
        {items.map((item) => (
          <AgendaEntry
            key={`${item.kind}-${item.id}`}
            item={item}
            markableUntilMinutes={markableUntilMinutes}
            onAttendanceChange={onAttendanceChange}
          />
        ))}
      </div>
    </div>
  );
}
