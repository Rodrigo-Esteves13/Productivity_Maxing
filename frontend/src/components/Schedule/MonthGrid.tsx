import { useState, type ReactNode } from 'react';
import { useMonthAgenda } from '../../hooks/useMonthAgenda';
import LinesSkeleton from '../UI/LinesSkeleton';
import ErrorState from '../UI/ErrorState';
import { toDateKey } from '../../lib/dateKey';
import { todayUtcAnchored } from '../../lib/weekDates';
import { weekdayLabel } from '../../lib/timeFormat';
import { MONTH_CHIP_TONE_CLASSES, chipTones, type MonthChip } from '../../lib/monthAgenda';
import { useI18n } from '../../i18n/useI18n';
import MonthDayCell from './MonthDayCell';
import MonthDayDetail from './MonthDayDetail';
import AgendaLegend from './AgendaLegend';
import Card from '../UI/Card';

// getUTCDay() de segunda a domingo, pela ordem das colunas.
const WEEKDAY_COLUMNS = [1, 2, 3, 4, 5, 6, 0];
const NO_CHIPS: MonthChip[] = [];

// Numero do dia na grelha de pontos: dia com exame vai a cheio (o destaque
// que interessa na epoca de exames), hoje so muda de cor.
function dayNumberClass(hasExam: boolean, isToday: boolean): string {
  if (hasExam) return 'bg-violet-600 font-semibold text-white';
  if (isToday) return 'font-semibold text-violet-300';
  return 'text-neutral-300';
}

interface MonthGridProps {
  // Mesmo sinal do WeekGrid: muda depois de um import ou de mexer em turnos.
  refreshKey: number;
  // Dia que decide o mes mostrado ao abrir a vista.
  initialDate: Date;
  // Botao Semana/Mes, desenhado no cabecalho ao lado da navegacao.
  viewToggle: ReactNode;
  onOpenWeek: (date: Date) => void;
}

// Vista mensal do Schedule: prazos (exames em destaque), aulas e turnos.
// Em ecras sm+ cada dia mostra chips com "+N"; no telemovel a grelha so
// tem pontos por tipo e a lista do dia escolhido aparece por baixo.
export default function MonthGrid({ refreshKey, initialDate, viewToggle, onOpenWeek }: MonthGridProps) {
  const { t, lang } = useI18n();
  const {
    monthStart,
    days,
    chipsByDay,
    isLoading,
    error,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  } = useMonthAgenda(initialDate, refreshKey);
  // Dia tocado no telemovel, preso ao mes em que foi tocado: ao mudar de
  // mes volta a hoje (ou ao dia 1) em vez de ficar num dia da orla.
  const [picked, setPicked] = useState<{ monthKey: string; dayKey: string } | null>(null);

  const todayKey = toDateKey(todayUtcAnchored());
  const monthKey = toDateKey(monthStart);
  const pickedKey = picked?.monthKey === monthKey ? picked.dayKey : null;
  const monthDays = days.filter((day) => day.inMonth);
  // Dia escolhido no telemovel: o tocado, senao hoje, senao o dia 1.
  const selectedDay =
    days.find((day) => day.key === pickedKey) ??
    monthDays.find((day) => day.key === todayKey) ??
    monthDays[0];
  const isMonthEmpty = monthDays.every((day) => !chipsByDay.has(day.key));
  // "outubro de 2026" -> "Outubro de 2026". So a primeira letra: o
  // `capitalize` do CSS tambem poria "De" em maiuscula.
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    monthStart,
  );
  const monthTitle = monthName.charAt(0).toLocaleUpperCase(lang) + monthName.slice(1);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('ui.schedule')}</h2>
          <p className="text-sm text-neutral-400">{monthTitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
          <button
            onClick={goToPreviousMonth}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.prev')}
          </button>
          <button
            onClick={goToCurrentMonth}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.today')}
          </button>
          <button
            onClick={goToNextMonth}
            className="text-sm text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800"
          >
            {t('ui.next')}
          </button>
        </div>
      </div>

      {isLoading && <LinesSkeleton lines={6} />}
      {!isLoading && error && <ErrorState message={error} />}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1" aria-hidden>
            {WEEKDAY_COLUMNS.map((dayOfWeek) => (
              <p key={dayOfWeek} className="truncate text-center text-[11px] font-medium text-neutral-500">
                {weekdayLabel(dayOfWeek, lang)}
              </p>
            ))}
          </div>

          <div className="hidden sm:grid grid-cols-7 gap-1.5">
            {days.map((day) => (
              <MonthDayCell
                key={day.key}
                day={day}
                chips={chipsByDay.get(day.key) ?? NO_CHIPS}
                isToday={day.key === todayKey}
                onOpenWeek={onOpenWeek}
              />
            ))}
          </div>

          <div className="grid sm:hidden grid-cols-7 gap-1">
            {days.map((day) => {
              const chips = chipsByDay.get(day.key) ?? NO_CHIPS;
              const hasExam = chips.some((chip) => chip.tone === 'exam');
              const isSelected = day.key === selectedDay?.key;
              const isToday = day.key === todayKey;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setPicked({ monthKey, dayKey: day.key })}
                  aria-pressed={isSelected}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-md py-1.5 ${
                    isSelected ? 'bg-neutral-800 ring-1 ring-violet-500' : 'hover:bg-neutral-800/60'
                  } ${day.inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`min-w-[1.5rem] rounded-full px-1 text-center text-xs ${dayNumberClass(hasExam, isToday)}`}>
                    {day.date.getUTCDate()}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                    {chipTones(chips).map((tone) => (
                      <span key={tone} className={`h-1.5 w-1.5 rounded-full ${MONTH_CHIP_TONE_CLASSES[tone].dot}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="sm:hidden">
              <MonthDayDetail
                day={selectedDay}
                chips={chipsByDay.get(selectedDay.key) ?? NO_CHIPS}
                onOpenWeek={onOpenWeek}
              />
            </div>
          )}

          {isMonthEmpty && <p className="mt-3 text-xs text-neutral-500">{t('schedule.month.empty')}</p>}

          <AgendaLegend />
        </>
      )}
    </Card>
  );
}
