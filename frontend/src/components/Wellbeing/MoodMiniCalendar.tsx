import { useCallback, useEffect, useState } from 'react';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { getMoodLogs } from '../../api/wellbeingService';
import type { useMoodToday } from '../../hooks/useMoodToday';
import { useI18n } from '../../i18n/useI18n';
import { dayKeyBefore, moodCalendarDays, MOOD_CALENDAR_DAYS } from '../../lib/moodCalendar';

// Meio-dia UTC do dia (AAAA-MM-DD), para o rotulo mostrar sempre esse dia.
const NOON_UTC_SUFFIX = 'T12:00:00Z';

// Quanto melhor o humor (1 a 5), mais forte o violeta; o numero vai no rotulo.
const MOOD_CLASS: Record<number, string> = {
  1: 'bg-violet-950 text-violet-200',
  2: 'bg-violet-900 text-violet-100',
  3: 'bg-violet-800 text-white',
  4: 'bg-violet-600 text-white',
  5: 'bg-violet-400 text-neutral-950',
};
const NO_MOOD_CLASS = 'border border-neutral-800 text-neutral-500';

interface MoodMiniCalendarProps {
  mood: ReturnType<typeof useMoodToday>;
}

// Os ultimos 30 dias de relance; clicar num dia muda o formulario para ele.
export default function MoodMiniCalendar({ mood }: MoodMiniCalendarProps) {
  const { t, lang } = useI18n();
  const { today, day, dayOffset, log, isLoading, error, setDayOffset } = mood;
  const [history, setHistory] = useState<Record<string, number> | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  // O que o formulario ja leu ou gravou ganha ao que veio no inicio.
  const [seen, setSeen] = useState<Record<string, number | null>>({});

  const load = useCallback(() => {
    setHasFailed(false);
    getMoodLogs(dayKeyBefore(today, MOOD_CALENDAR_DAYS - 1), today)
      .then((logs) => setHistory(Object.fromEntries(logs.map((l) => [l.date, l.mood]))))
      .catch(() => setHasFailed(true));
  }, [today]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!isLoading && !error) setSeen((prev) => ({ ...prev, [day]: log?.mood ?? null }));
  }, [day, log, isLoading, error]);

  if (hasFailed) return <ErrorState message={t('wellbeing.mood.loadError')} onRetry={load} />;
  if (!history) return <LinesSkeleton lines={3} />;

  const days = moodCalendarDays(today, { ...history, ...seen });

  return (
    <div className="mt-5 border-t border-neutral-800 pt-4">
      <h3 className="mb-2 text-sm font-medium text-neutral-200">
        {t('ux4global.mood.calendar', { count: MOOD_CALENDAR_DAYS })}
      </h3>
      <ol className="grid grid-cols-6 gap-1 sm:grid-cols-10">
        {days.map((entry) => {
          const date = new Date(`${entry.key}${NOON_UTC_SUFFIX}`);
          const label = date.toLocaleDateString(lang, { timeZone: 'UTC', day: 'numeric', month: 'short' });
          const description =
            entry.mood === null
              ? t('ux4global.mood.dayEmpty', { date: label })
              : t('ux4global.mood.dayLogged', { date: label, mood: entry.mood });
          const isSelected = entry.offset === dayOffset;
          return (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => setDayOffset(entry.offset)}
                aria-label={description}
                aria-pressed={isSelected}
                title={description}
                className={`flex h-9 w-full items-center justify-center rounded-md text-xs tabular-nums pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
                  entry.mood === null ? NO_MOOD_CLASS : MOOD_CLASS[entry.mood]
                } ${isSelected ? 'ring-2 ring-white' : ''}`}
              >
                {date.getUTCDate()}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
