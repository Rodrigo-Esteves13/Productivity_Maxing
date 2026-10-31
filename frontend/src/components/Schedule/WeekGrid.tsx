import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSchedule } from '../../hooks/useSchedule';
import { useWorkShiftRange } from '../../hooks/useWorkShiftRange';
import { useScheduleTasks } from '../../hooks/useScheduleTasks';
import LinesSkeleton from '../UI/LinesSkeleton';
import ErrorState from '../UI/ErrorState';
import type { ClassOccurrence, WorkShiftOccurrence } from '../../types/models';
import { toDateKey } from '../../lib/dateKey';
import { mergeAgenda } from '../../lib/agenda';
import { buildDeadlineChips, type DeadlineChip } from '../../lib/monthAgenda';
import { weekdayLabel } from '../../lib/timeFormat';
import { todayUtcAnchored } from '../../lib/weekDates';
import { minutesSinceMidnight } from '../../lib/todayOverview';
import { useFeedback } from '../../context/useFeedback';
import WeekDayCell from './WeekDayCell';
import ShiftChangeModal from './ShiftChangeModal';
import { ptHolidayOn } from '../../lib/ptHolidays';
import AgendaLegend from './AgendaLegend';
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';
import ToolbarButton from '../UI/ToolbarButton';

const NO_DEADLINES: DeadlineChip[] = [];

// Na lingua da app, nao na do browser (antes dava "Oct 26" com a app em PT).
function formatRangeLabel(start: Date, end: Date, locale: string): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)} - ${fmt(end)}`;
}

interface WeekGridProps {
  // Muda sempre que um import de horário termina (ver Schedule.tsx) -
  // useSchedule é dono do seu próprio fetch, só precisa de um sinal
  // externo para saber que vale a pena repetir o pedido.
  refreshKey: number;
  // Dia cuja semana abre primeiro (ex: o dia clicado na vista mensal).
  initialDate?: Date;
  // Botao Semana/Mes, desenhado ao lado da navegacao.
  viewToggle?: ReactNode;
  // Chamado depois de gravar uma presenca (o resumo de presencas refaz o fetch).
  onAttendanceChanged?: () => void;
  // Aula desmarcada ou turno mudado: a pagina refaz o plano e pergunta se
  // o Google Calendar deve ser atualizado.
  onScheduleChanged?: () => void;
}

export default function WeekGrid({
  refreshKey,
  initialDate,
  viewToggle,
  onAttendanceChanged,
  onScheduleChanged,
}: WeekGridProps) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const {
    weekStart,
    weekEnd,
    occurrences,
    isLoading,
    error,
    refetch,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    setAttendance,
    setCancelled,
  } = useSchedule(initialDate);
  const [changingShift, setChangingShift] = useState<WorkShiftOccurrence | null>(null);

  const handleAttendance = useCallback(
    async (occurrence: ClassOccurrence, attended: boolean | null) => {
      const saved = await setAttendance(occurrence, attended);
      if (saved) onAttendanceChanged?.();
      else notify(t('attendance.failed'), 'error');
    },
    [setAttendance, onAttendanceChanged, notify, t],
  );

  const handleCancelled = useCallback(
    async (occurrence: ClassOccurrence, cancelled: boolean) => {
      const saved = await setCancelled(occurrence, cancelled);
      if (!saved) {
        notify(t('classCancel.failed'), 'error');
        return;
      }
      notify(t(cancelled ? 'classCancel.done' : 'classCancel.undone', { subject: occurrence.subject }), 'success');
      onAttendanceChanged?.();
      onScheduleChanged?.();
    },
    [setCancelled, notify, t, onAttendanceChanged, onScheduleChanged],
  );

  useEffect(() => {
    if (refreshKey > 0) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só queremos reagir a refreshKey, refetch já está sempre atualizado
  }, [refreshKey]);

  const shiftOccurrences = useWorkShiftRange(
    toDateKey(weekStart),
    toDateKey(weekEnd),
    refreshKey,
    true,
  );
  // Prazos sao best-effort, como os turnos: se falharem a grelha de aulas
  // continua a aparecer (a vista mensal e que mostra o erro).
  const { tasks } = useScheduleTasks();
  const deadlinesByDay = useMemo(() => buildDeadlineChips(tasks), [tasks]);

  const shiftsByDay = new Map<string, WorkShiftOccurrence[]>();
  for (const shift of shiftOccurrences) {
    const list = shiftsByDay.get(shift.date) ?? [];
    list.push(shift);
    shiftsByDay.set(shift.date, list);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + i);
    return date;
  });

  const occurrencesByDay = new Map<string, ClassOccurrence[]>();
  for (const occ of occurrences) {
    const key = occ.date.slice(0, 10);
    const list = occurrencesByDay.get(key) ?? [];
    list.push(occ);
    occurrencesByDay.set(key, list);
  }

  const todayKey = toDateKey(todayUtcAnchored());
  const holidayName = (key: string): string | undefined => {
    const holiday = ptHolidayOn(key);
    return holiday ? t(`holiday.${holiday.key}`) : undefined;
  };
  const nowMinutes = minutesSinceMidnight(new Date());
  // So aulas que ja comecaram podem ter presenca (ver WeekDayCell).
  const markableUntil = (key: string): number | null =>
    key < todayKey ? Number.POSITIVE_INFINITY : key === todayKey ? nowMinutes : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        {/* O titulo "Schedule" ja esta no cabecalho da pagina: aqui so a semana. */}
        <h2 className="text-lg font-semibold tabular-nums text-white">{formatRangeLabel(weekStart, weekEnd, lang)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
          <ToolbarButton tone="muted" size="md" onClick={goToPreviousWeek}>
            {t('ui.prev')}
          </ToolbarButton>
          <ToolbarButton tone="muted" size="md" onClick={goToCurrentWeek}>
            {t('ui.today')}
          </ToolbarButton>
          <ToolbarButton tone="muted" size="md" onClick={goToNextWeek}>
            {t('ui.next')}
          </ToolbarButton>
        </div>
      </div>

      {isLoading && <LinesSkeleton lines={6} />}
      {!isLoading && error && <ErrorState message={error} />}

      {!isLoading && !error && (
        // 1 coluna no telemovel, 2 em ecras medios e 7 so em ecras largos:
        // 7 colunas em 640px deixavam cada dia com ~80px e o texto cortado.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((date) => {
            const key = toDateKey(date);
            return (
              <WeekDayCell
                key={key}
                label={weekdayLabel(date.getUTCDay(), lang)}
                dayOfMonth={date.getUTCDate()}
                isToday={key === todayKey}
                deadlines={deadlinesByDay.get(key) ?? NO_DEADLINES}
                items={mergeAgenda(occurrencesByDay.get(key) ?? [], shiftsByDay.get(key) ?? [])}
                markableUntilMinutes={markableUntil(key)}
                onAttendanceChange={handleAttendance}
                onCancelChange={handleCancelled}
                onShiftClick={setChangingShift}
                holidayName={holidayName(key)}
              />
            );
          })}
        </div>
      )}

      {!isLoading && !error && <AgendaLegend />}

      {changingShift && (
        <ShiftChangeModal
          occurrence={changingShift}
          onClose={() => setChangingShift(null)}
          onChanged={() => onScheduleChanged?.()}
        />
      )}
    </Card>
  );
}
