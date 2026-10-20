import type { MonthGridDay } from '../../lib/monthGrid';
import type { MonthChip } from '../../lib/monthAgenda';
import { formatDayLabel } from '../../lib/timeFormat';
import { useI18n } from '../../i18n/useI18n';
import { useMonthChipLabel } from '../../hooks/useMonthChipLabel';
import MonthChipPill from './MonthChipPill';

// Chips visiveis por dia antes do "+N". Prazos vem primeiro (ver
// buildMonthAgenda), por isso um exame nunca fica escondido atras de aulas.
const MAX_VISIBLE_CHIPS = 3;

interface MonthDayCellProps {
  day: MonthGridDay;
  chips: MonthChip[];
  isToday: boolean;
  onOpenWeek: (date: Date) => void;
}

// Um dia da grelha mensal em ecras sm+. Clicar abre essa semana na vista semanal.
export default function MonthDayCell({ day, chips, isToday, onOpenWeek }: MonthDayCellProps) {
  const { t } = useI18n();
  const chipLabel = useMonthChipLabel();
  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const hidden = chips.slice(MAX_VISIBLE_CHIPS);

  return (
    <button
      type="button"
      onClick={() => onOpenWeek(day.date)}
      title={t('schedule.month.openWeek')}
      className={`flex flex-col items-stretch min-w-0 min-h-[6.5rem] rounded-lg border p-1.5 text-left transition-colors hover:border-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        isToday ? 'border-violet-600/60 bg-violet-950/20' : 'border-neutral-800'
      } ${day.inMonth ? '' : 'opacity-50'}`}
    >
      <span className={`mb-1 text-xs font-medium ${isToday ? 'text-violet-300' : 'text-neutral-300'}`}>
        <span aria-hidden>{day.date.getUTCDate()}</span>
        <span className="sr-only">{formatDayLabel(day.key)}</span>
      </span>
      <span className="flex flex-col gap-1 min-w-0">
        {visible.map((chip) => (
          <MonthChipPill key={chip.id} chip={chip} />
        ))}
        {hidden.length > 0 && (
          <span
            title={hidden.map(chipLabel).join('\n')}
            className="px-1 text-[11px] font-medium text-neutral-400"
          >
            {t('schedule.month.more', { count: hidden.length })}
          </span>
        )}
      </span>
    </button>
  );
}
