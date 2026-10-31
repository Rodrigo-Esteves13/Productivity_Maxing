import type { MonthGridDay } from '../../lib/monthGrid';
import { MONTH_CHIP_TONE_CLASSES, type MonthChip } from '../../lib/monthAgenda';
import { formatDayLabel } from '../../lib/timeFormat';
import ViewTaskButton from '../UI/ViewTaskButton';
import { GraduationCapIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { useMonthChipLabel } from '../../hooks/useMonthChipLabel';
import { ptHolidayOn } from '../../lib/ptHolidays';

interface MonthDayDetailProps {
  day: MonthGridDay;
  chips: MonthChip[];
  onOpenWeek: (date: Date) => void;
}

// Lista completa do dia escolhido na grelha de pontos (telemovel).
export default function MonthDayDetail({ day, chips, onOpenWeek }: MonthDayDetailProps) {
  const { t } = useI18n();
  const chipLabel = useMonthChipLabel();
  const holiday = ptHolidayOn(day.key);

  return (
    <section className="mt-4 border-t border-neutral-800 pt-3" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white">{formatDayLabel(day.key)}</h3>
          {holiday && <p className="text-xs font-medium text-amber-300">{t(`holiday.${holiday.key}`)}</p>}
        </div>
        <button
          type="button"
          onClick={() => onOpenWeek(day.date)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-violet-300 hover:bg-neutral-800 hover:text-violet-200"
        >
          {t('schedule.month.openWeek')}
        </button>
      </div>
      {chips.length === 0 && <p className="text-xs text-neutral-500">{t('schedule.month.nothingThisDay')}</p>}
      {chips.length > 0 && (
        <ul className="space-y-1.5">
          {chips.map((chip) => (
            <li
              key={chip.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${MONTH_CHIP_TONE_CLASSES[chip.tone].chip}`}
            >
              {chip.tone === 'exam' && <GraduationCapIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={`font-medium leading-tight break-words ${chip.done ? 'line-through opacity-60' : ''}`}>
                  {chipLabel(chip)}
                </p>
                {chip.time && <p className="leading-tight opacity-70">{chip.time}</p>}
              </div>
              {chip.taskId && <ViewTaskButton taskId={chip.taskId} title={chipLabel(chip)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
