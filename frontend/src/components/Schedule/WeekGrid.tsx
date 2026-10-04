import { useEffect } from 'react';
import { useSchedule } from '../../hooks/useSchedule';
import { useWorkShiftRange } from '../../hooks/useWorkShiftRange';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';
import type { ClassOccurrence, WorkShiftOccurrence } from '../../types/models';
import { toDateKey } from '../../lib/dateKey';
import { mergeAgenda } from '../../lib/agenda';
import { todayUtcAnchored } from '../../lib/weekDates';
import WeekDayCell from './WeekDayCell';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)} - ${fmt(end)}`;
}

interface WeekGridProps {
  // Muda sempre que um import de horário termina (ver Schedule.tsx) -
  // useSchedule é dono do seu próprio fetch, só precisa de um sinal
  // externo para saber que vale a pena repetir o pedido.
  refreshKey: number;
}

export default function WeekGrid({ refreshKey }: WeekGridProps) {
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
  } = useSchedule();

  useEffect(() => {
    if (refreshKey > 0) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só queremos reagir a refreshKey, refetch já está sempre atualizado
  }, [refreshKey]);

  const shiftOccurrences = useWorkShiftRange(
    toDateKey(weekStart),
    toDateKey(weekEnd),
    refreshKey,
  );
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
          <h2 className="text-lg font-semibold text-white">Schedule</h2>
          <p className="text-sm text-neutral-400">{formatRangeLabel(weekStart, weekEnd)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            ‹ Prev
          </button>
          <button
            onClick={goToCurrentWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            Today
          </button>
          <button
            onClick={goToNextWeek}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            Next ›
          </button>
        </div>
      </div>

      {isLoading && <LoadingState message="Loading schedule..." />}
      {!isLoading && error && <ErrorState message={error} />}

      {!isLoading && !error && (
        // 1 coluna no telemovel, 2 em ecras medios e 7 so em ecras largos:
        // 7 colunas em 640px deixavam cada dia com ~80px e o texto cortado.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((date, i) => {
            const key = toDateKey(date);
            return (
              <WeekDayCell
                key={key}
                label={DAY_LABELS[i]}
                dayOfMonth={date.getUTCDate()}
                isToday={key === todayKey}
                items={mergeAgenda(occurrencesByDay.get(key) ?? [], shiftsByDay.get(key) ?? [])}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
