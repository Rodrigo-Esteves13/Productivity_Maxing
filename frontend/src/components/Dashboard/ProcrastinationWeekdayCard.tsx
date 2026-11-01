import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeProcrastinationWeekdays } from '../../lib/procrastinationWeekdays';
import { weekdayLabel } from '../../lib/timeFormat';
import { CalendarIcon } from '../UI/Icons';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface ProcrastinationWeekdayCardProps {
  tasks: Task[];
}

// Monday-first, JS getDay() numbers.
const DAYS = [1, 2, 3, 4, 5, 6, 0];

// On which weekday postponed tasks currently sit. Approximation: there is no
// per-postponement history, so it uses the current due date weighted by
// postponedCount (stated in the help line).
export default function ProcrastinationWeekdayCard({ tasks }: ProcrastinationWeekdayCardProps) {
  const { t, lang } = useI18n();
  const data = useMemo(() => computeProcrastinationWeekdays(tasks), [tasks]);
  if (!data.hasEnoughData) return null;

  const labels = DAYS.map((d) => weekdayLabel(d, lang));
  const max = Math.max(...data.counts);
  const peakNames = data.peaks.map((i) => labels[i]).join(', ');

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <CalendarIcon className="shrink-0" />
        {t('procrastination.title')}
      </CardHeading>
      <CardBody>
        <p className="text-xs text-neutral-500 mb-3">
          {data.noVariation
            ? t('procrastination.noVariation')
            : t('procrastination.peak', { days: peakNames, max, total: data.total })}
        </p>
        <div className="flex items-end gap-2 h-24">
          {data.counts.map((c, i) => (
            <div
              key={labels[i]}
              className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              title={t('procrastination.dayTitle', { day: labels[i], count: c })}
            >
              <div className="w-full flex-1 flex flex-col justify-end">
                <div
                  className={`w-full rounded-t-sm ${data.peaks.includes(i) ? 'bg-violet-500' : 'bg-neutral-700'}`}
                  style={{ height: `${max > 0 ? (c / max) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-500">{labels[i]}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-neutral-500">
          {data.isEarlySignal ? `${t('procrastination.early', { n: data.total })} ` : ''}
          {t('procrastination.help')}
        </p>
      </CardBody>
    </DashboardCard>
  );
}
