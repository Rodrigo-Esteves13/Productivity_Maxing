import { useEffect } from 'react';
import { useSchedule } from '../../hooks/useSchedule';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';
import type { ClassOccurrence } from '../../types/models';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// weekStart/weekEnd (de useSchedule.ts) e todayKey têm de ser calculados
// com os MESMOS métodos (UTC) - misturar getDate()/setDate() (hora local)
// com toISOString() (UTC) foi exatamente o bug do dia errado que já
// apanhámos aqui uma vez (ver comentário grande em useSchedule.ts).
function todayUtcAnchored(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

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
  for (const list of occurrencesByDay.values()) {
    list.sort((a, b) => a.startMinutes - b.startMinutes);
  }

  const todayKey = toDateKey(todayUtcAnchored());

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {days.map((date, i) => {
            const key = toDateKey(date);
            const classes = occurrencesByDay.get(key) ?? [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`rounded-lg border p-2 min-h-[6rem] ${
                  isToday ? 'border-violet-600/60 bg-violet-950/20' : 'border-neutral-800'
                }`}
              >
                <p className="text-xs font-medium text-neutral-300 mb-2">
                  {DAY_LABELS[i]} {date.getUTCDate()}
                </p>
                <div className="space-y-1.5">
                  {classes.length === 0 && <p className="text-xs text-neutral-600">-</p>}
                  {classes.map((occ) => (
                    <div key={occ.id} className="text-xs bg-neutral-800/60 rounded-md px-2 py-1">
                      <p className="text-neutral-200 font-medium leading-tight">{occ.subject}</p>
                      <p className="text-neutral-500 leading-tight">
                        {formatMinutes(occ.startMinutes)}-{formatMinutes(occ.endMinutes)}
                        {occ.location ? ` · ${occ.location}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
