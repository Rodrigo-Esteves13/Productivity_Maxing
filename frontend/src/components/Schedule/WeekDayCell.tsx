import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatClock } from '../../lib/timeFormat';
import type { AgendaItem } from '../../lib/agenda';
import { AGENDA_TONE_CLASSES, getAgendaTone } from '../../lib/agendaTone';
import { MONTH_CHIP_TONE_CLASSES, pinDeadlinesToClasses, type DeadlineChip } from '../../lib/monthAgenda';
import { CalendarXIcon, GraduationCapIcon } from '../UI/Icons';
import type { ClassOccurrence, WorkShiftOccurrence } from '../../types/models';
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
  // Professor faltou / aula desmarcada (ou desfazer).
  onCancelChange?: (occurrence: ClassOccurrence, cancelled: boolean) => void;
  // Abre "mudar este turno" (folga, outra hora, ferias) num turno semanal.
  onShiftClick?: (occurrence: WorkShiftOccurrence) => void;
  // Nome traduzido do feriado nacional deste dia.
  holidayName?: string;
}

interface AgendaEntryProps {
  item: AgendaItem;
  // Testes/entregas desta aula (mesma cadeira, mesmo dia).
  pinned?: DeadlineChip[];
  markableUntilMinutes: number | null;
  onAttendanceChange?: WeekDayCellProps['onAttendanceChange'];
  onCancelChange?: WeekDayCellProps['onCancelChange'];
  onShiftClick?: WeekDayCellProps['onShiftClick'];
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

const NO_PINNED: DeadlineChip[] = [];

// Prazo dentro do bloco de uma aula: pilula compacta, a cadeira ja esta
// escrita no bloco. Exames a cheio, o resto em contorno, como os chips soltos.
function PinnedDeadline({ chip }: { chip: DeadlineChip }) {
  const { t } = useI18n();
  const title = chip.label ?? '';
  const isExam = chip.tone === 'exam';
  return (
    <Link
      to={`/tasks?open=${encodeURIComponent(chip.taskId)}`}
      title={t('common.openTaskNamed', { title })}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-tight transition-colors hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        isExam ? 'bg-violet-600 text-white' : 'border border-violet-500/60 bg-violet-950/60 text-violet-200'
      }`}
    >
      <GraduationCapIcon aria-hidden className="h-3 w-3 shrink-0" />
      <span className={`truncate ${chip.done ? 'line-through opacity-60' : ''}`}>{title}</span>
    </Link>
  );
}

function AgendaEntry({
  item,
  pinned = NO_PINNED,
  markableUntilMinutes,
  onAttendanceChange,
  onCancelChange,
  onShiftClick,
}: AgendaEntryProps) {
  const { t } = useI18n();
  const tone = AGENDA_TONE_CLASSES[getAgendaTone(item)];
  const time = `${formatClock(item.startMinutes)}-${formatClock(item.endMinutes)}`;

  if (item.kind === 'class') {
    const { subject, location } = item.occurrence;
    const isCancelled = item.occurrence.cancelled === true;
    const canMark =
      !isCancelled &&
      Boolean(onAttendanceChange) &&
      markableUntilMinutes !== null &&
      item.startMinutes <= markableUntilMinutes;
    const hasPinned = pinned.length > 0;
    const cancelLabel = t(isCancelled ? 'classCancel.undo' : 'classCancel.mark', { subject });
    return (
      <div
        className={`text-xs rounded-md px-2 py-1.5 ${
          isCancelled ? 'border border-dashed border-neutral-700 bg-transparent' : tone.card
        } ${hasPinned ? 'ring-1 ring-violet-500/70' : ''} ${!isCancelled && item.occurrence.attended === false ? 'opacity-60' : ''}`}
      >
        {/* Avaliacao desta aula no topo do bloco: um so cartao em vez de
            um chip solto mais a aula, que pareciam dois eventos. */}
        {hasPinned && (
          <div className="mb-1 flex flex-wrap gap-1">
            {pinned.map((chip) => (
              <PinnedDeadline key={chip.id} chip={chip} />
            ))}
          </div>
        )}
        {/* 2 linhas no maximo, com hifenizacao: nomes de cadeiras longos
            partiam letra a letra. O nome inteiro fica no title. */}
        <p
          title={subject}
          className={`font-medium leading-snug hyphens-auto line-clamp-2 ${
            isCancelled ? 'text-neutral-400 line-through' : tone.title
          }`}
        >
          {subject}
        </p>
        <p className={`${isCancelled ? 'text-neutral-500' : tone.meta} mt-0.5 leading-tight tabular-nums`}>
          {isCancelled ? t('classCancel.label') : time}
          {!isCancelled && location ? ` · ${location}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {canMark && (
            <AttendanceToggle
              subject={subject}
              attended={item.occurrence.attended}
              onChange={(attended) => onAttendanceChange?.(item.occurrence, attended)}
            />
          )}
          {onCancelChange && (
            <button
              type="button"
              aria-pressed={isCancelled}
              aria-label={cancelLabel}
              title={cancelLabel}
              onClick={() => onCancelChange(item.occurrence, !isCancelled)}
              className={`flex h-6 w-6 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                isCancelled
                  ? 'border-amber-600 bg-amber-900/50 text-amber-200'
                  : 'border-neutral-700 text-neutral-500 hover:text-white'
              }`}
            >
              <CalendarXIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const isEvent = getAgendaTone(item) === 'event';
  const shift = item.occurrence;
  const name = shift.label ?? t(isEvent ? 'schedule.fallback.event' : 'schedule.fallback.work');
  const skipped = shift.skipped ?? null;
  const body = (
    <>
      <p
        className={`font-medium leading-snug hyphens-auto line-clamp-2 ${
          skipped ? 'text-neutral-400 line-through' : tone.title
        }`}
      >
        {name}
      </p>
      <p className={`${skipped ? 'text-neutral-500' : tone.meta} mt-0.5 leading-tight tabular-nums`}>
        {skipped === 'HOLIDAY'
          ? t('shiftChange.badge.holiday')
          : skipped === 'OFF'
            ? t('shiftChange.badge.off')
            : time}
        {shift.retimed && !skipped && <span className="ml-1">{t('shiftChange.badge.changed')}</span>}
      </p>
    </>
  );
  const boxClass = `block w-full text-left text-xs rounded-md px-2 py-1.5 ${
    skipped ? 'border border-dashed border-neutral-700 bg-transparent' : tone.card
  }`;
  // So os turnos semanais tem excecoes; um pontual edita-se nos compromissos.
  if (onShiftClick && shift.isRecurring) {
    return (
      <button
        type="button"
        onClick={() => onShiftClick(shift)}
        title={t('shiftChange.open', { label: name })}
        aria-haspopup="dialog"
        className={`${boxClass} transition-colors hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
      >
        {body}
      </button>
    );
  }
  return <div className={boxClass}>{body}</div>;
}

// Um dia da grelha semanal: prazos soltos primeiro, depois aulas e turnos
// misturados por ordem de hora. Prazos de uma cadeira com aula nesse dia
// ficam dentro do bloco da aula (ver pinDeadlinesToClasses).
export default function WeekDayCell({
  label,
  dayOfMonth,
  isToday,
  deadlines,
  items,
  markableUntilMinutes = null,
  onAttendanceChange,
  onCancelChange,
  onShiftClick,
  holidayName,
}: WeekDayCellProps) {
  const { byClassId, loose } = useMemo(() => pinDeadlinesToClasses(deadlines, items), [deadlines, items]);
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
      {holidayName && (
        <p className="-mt-1 mb-2 px-0.5 text-[11px] font-medium leading-tight text-amber-300">{holidayName}</p>
      )}
      <div className="space-y-1.5">
        {loose.map((chip) => (
          <DeadlineEntry key={chip.id} chip={chip} />
        ))}
        {items.map((item) => (
          <AgendaEntry
            key={`${item.kind}-${item.id}`}
            item={item}
            pinned={byClassId.get(item.id)}
            markableUntilMinutes={markableUntilMinutes}
            onAttendanceChange={onAttendanceChange}
            onCancelChange={onCancelChange}
            onShiftClick={onShiftClick}
          />
        ))}
      </div>
    </div>
  );
}
