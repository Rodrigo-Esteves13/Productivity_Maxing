import { MINUTES_PER_HOUR, MS_PER_DAY } from '../../lib/timeConstants';
import { roundTo } from '../../utils/roundTo';
import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { OVERLOAD_THRESHOLD, OVERLOAD_WINDOW_DAYS } from '../../utils/detectOverloadWeek';
import { AlertTriangleIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { hasFirmDate } from '../../lib/taskReadiness';
import { suggestLighterDay } from '../../lib/lighterDay';

interface DayLoadHintProps {
  // "YYYY-MM-DD" escolhido no formulario.
  date: string;
  tasks: Task[];
  // A propria task em edicao nao conta para a carga.
  excludeTaskId?: string;
  // Se vier, oferece mover a data para um dia mais livre.
  onPickDate?: (date: string) => void;
}

// Tasks sem hora ficam a meia-noite UTC (o dia e o do ISO); com hora usa-se o
// dia local, igual ao TaskEditForm.
function dayKeyOf(task: Task): string {
  const d = new Date(task.date);
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  if (isDateOnly) return task.date.split('T')[0];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayIndex(key: string): number {
  return Math.floor(new Date(`${key}T00:00:00Z`).getTime() / MS_PER_DAY);
}

function formatHours(minutes: number): string {
  const hours = roundTo(minutes / MINUTES_PER_HOUR);
  return `${hours}h`;
}

// Aviso ao escolher a data: esse dia, ou os 7 dias a partir dele, ja estao
// carregados? Mesmo criterio do OverloadAlertCard (contagem de tasks por
// fazer), so frontend, sobre as tasks que a pagina ja tem.
export default function DayLoadHint({ date, tasks, excludeTaskId, onPickDate }: DayLoadHintProps) {
  const { t } = useI18n();
  const load = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const start = dayIndex(date);
    // So prazos reais pesam no dia (um palpite nao enche a semana).
    const pending = tasks.filter(
      (t) => t.progressStatus !== 'COMPLETED' && t.id !== excludeTaskId && hasFirmDate(t),
    );

    const sameDay = pending.filter((t) => dayKeyOf(t) === date);
    const inWindow = pending.filter((t) => {
      const offset = dayIndex(dayKeyOf(t)) - start;
      return offset >= 0 && offset < OVERLOAD_WINDOW_DAYS;
    });
    const estimated = sameDay.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
    const counts = new Map<string, number>();
    for (const task of pending) counts.set(dayKeyOf(task), (counts.get(dayKeyOf(task)) ?? 0) + 1);
    return { sameDay, inWindow, estimated, lighterDay: suggestLighterDay(date, counts) };
  }, [date, tasks, excludeTaskId]);

  if (!load) return null;

  // +1 porque a task que se esta a criar tambem entra na janela.
  const heavyWeek = load.inWindow.length + 1 >= OVERLOAD_THRESHOLD;
  const busyDay = load.sameDay.length >= 2;
  if (!heavyWeek && !busyDay) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/10 px-3 py-2 text-xs text-amber-300"
      role="status"
    >
      <AlertTriangleIcon className="shrink-0 mt-0.5" width={14} height={14} />
      <div className="space-y-0.5">
        {busyDay && (
          <p>
            {load.estimated > 0
              ? t('ui.otherTasksDueEstimated', { count: load.sameDay.length, hours: formatHours(load.estimated) })
              : t('ui.otherTasksDue', { count: load.sameDay.length })}
          </p>
        )}
        {heavyWeek && (
          <p>
            {t('ui.heavyStretchPendingTasksFall', { inWindowCount: load.inWindow.length })}</p>
        )}
        {onPickDate && load.lighterDay && (
          <p className="flex flex-wrap items-center gap-2">
            <span>{t('lighterDay.text', { date: new Date(`${load.lighterDay}T00:00:00`).toLocaleDateString() })}</span>
            <button
              type="button"
              onClick={() => onPickDate(load.lighterDay as string)}
              className="rounded-md border border-amber-700 px-2 py-0.5 font-semibold hover:bg-amber-900/40"
            >
              {t('lighterDay.apply')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
