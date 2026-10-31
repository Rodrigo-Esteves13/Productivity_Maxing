import { useEffect, useMemo, useState } from 'react';
import { getSchedule } from '../../api/scheduleService';
import { isRequestCanceled } from '../../lib/abortable';
import { classTimeSuggestion } from '../../lib/classTimeSuggestion';
import { useI18n } from '../../i18n/useI18n';
import { ClockIcon, XIcon } from '../UI/Icons';
import type { ClassOccurrence } from '../../types/models';

interface ClassTimeSuggestionHintProps {
  isEventType: boolean;
  date: string;
  calendarTime: string;
  timeFieldVisible: boolean;
  areaId: string;
  areaName: string | undefined;
  onApply: (time: string, durationMinutes: number) => void;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Sugestao dispensavel no formulario de uma task-evento: "Use class time".
// So pede o horario desse dia quando pode haver sugestao; nunca aplica sozinha.
export default function ClassTimeSuggestionHint({
  isEventType,
  date,
  calendarTime,
  timeFieldVisible,
  areaId,
  areaName,
  onApply,
}: ClassTimeSuggestionHintProps) {
  const { t } = useI18n();
  const [classes, setClasses] = useState<ClassOccurrence[]>([]);
  // Dispensada para esta combinacao dia + cadeira; mudar um deles volta a mostrar.
  const [dismissedKey, setDismissedKey] = useState('');
  const contextKey = `${date}|${areaId}`;
  const shouldFetch = isEventType && timeFieldVisible && !!areaId && DAY_KEY.test(date) && !calendarTime;

  useEffect(() => {
    if (!shouldFetch) return;
    const controller = new AbortController();
    getSchedule(date, date, controller.signal)
      .then(setClasses)
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        // Sugestao e um extra: falhar a carregar nao deve incomodar.
        setClasses([]);
      });
    return () => controller.abort();
  }, [shouldFetch, date]);

  const suggestion = useMemo(
    () =>
      classTimeSuggestion({
        isEventType,
        date,
        calendarTime,
        timeFieldVisible,
        areaName,
        classes,
      }),
    [isEventType, date, calendarTime, timeFieldVisible, areaName, classes],
  );

  if (!suggestion || dismissedKey === contextKey) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-violet-800/50 bg-violet-900/10 px-3 py-2 text-xs text-violet-300"
      role="status"
    >
      <ClockIcon className="shrink-0" width={14} height={14} />
      <button
        type="button"
        onClick={() => onApply(suggestion.time, suggestion.durationMinutes)}
        className="flex-1 text-left font-medium hover:text-violet-200 focus:outline-none focus-visible:underline"
      >
        {t('classTime.use', { range: suggestion.rangeLabel })}
      </button>
      <button
        type="button"
        onClick={() => setDismissedKey(contextKey)}
        aria-label={t('classTime.dismiss')}
        className="shrink-0 rounded p-0.5 text-violet-400 hover:text-violet-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-600"
      >
        <XIcon width={14} height={14} />
      </button>
    </div>
  );
}
