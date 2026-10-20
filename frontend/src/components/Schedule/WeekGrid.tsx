import { useEffect, useMemo, type ReactNode } from 'react';
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
import WeekDayCell from './WeekDayCell';
import AgendaLegend from './AgendaLegend';
import { useI18n } from '../../i18n/useI18n';

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
}

export default function WeekGrid({ refreshKey, initialDate, viewToggle }: WeekGridProps) {
  const { t, lang } = useI18n();
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
  } = useSchedule(initialDate);

  useEffect(() => {
    if (refreshKey > 0) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só queremos reagir a refreshKey, refetch já está sempre atualizado
  }, [refreshKey]);

  const shiftOccurrences = useWorkShiftRange(
    toDateKey(weekStart),
    toDateKey(weekEnd),
    refreshKey,
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

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('ui.schedule')}</h2>
          <p className="text-sm text-neutral-400">{formatRangeLabel(weekStart, weekEnd, lang)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
          <button
            onClick={goToPreviousWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.prev')}
          </button>
          <button
            onClick={goToCurrentWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.today')}
          </button>
          <button
            onClick={goToNextWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.next')}
          </button>
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
              />
            );
          })}
        </div>
      )}

      {!isLoading && !error && <AgendaLegend />}
    </div>
  );
}
