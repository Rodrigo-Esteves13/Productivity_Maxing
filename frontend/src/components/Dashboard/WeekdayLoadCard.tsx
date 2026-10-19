import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeWeekdayDistribution } from '../../utils/weekdayDistribution';
import { CalendarIcon } from '../UI/Icons';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import LegendItem from '../UI/LegendItem';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

interface WeekdayLoadCardProps {
  tasks: Task[];
}

const MIN_TASKS_TO_SHOW = 5;

// Which weekdays deadlines tend to pile up on. Pending and completed are
// stacked so a busy-but-already-done day doesn't look like a problem.
export default function WeekdayLoadCard({ tasks }: WeekdayLoadCardProps) {
  const { t } = useI18n();
  const buckets = useMemo(() => computeWeekdayDistribution(tasks), [tasks]);
  const total = buckets.reduce((s, b) => s + b.total, 0);
  if (total < MIN_TASKS_TO_SHOW) return null;

  const max = Math.max(...buckets.map((b) => b.total));
  const busiest = buckets.find((b) => b.total === max);

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <CalendarIcon className="shrink-0" />
        {t('ui.deadlinesByWeekday')}
      </CardHeading>
      <CardBody>
        <p className="text-xs text-neutral-500 mb-3">
          {fillNodes(t('ui.busiestWeekday', { max, total }), {
            day: <span className="text-neutral-200">{busiest?.label}</span>,
          })}
        </p>
        <div className="flex items-end gap-2 h-24">
          {buckets.map((b) => (
            <div
              key={b.label}
              className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              title={t('ui.weekdayPendingCompleted', { day: b.label, pending: b.pending, completed: b.completed })}
            >
              <div className="w-full flex-1 flex flex-col justify-end">
                <div
                  className="w-full bg-violet-500 rounded-t-sm"
                  style={{ height: `${max > 0 ? (b.pending / max) * 100 : 0}%` }}
                />
                <div
                  className="w-full bg-neutral-700"
                  style={{ height: `${max > 0 ? (b.completed / max) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-500">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-neutral-500">
          <LegendItem dotClassName="bg-violet-500">{t('ui.pending')}</LegendItem>
          <LegendItem dotClassName="bg-neutral-700">{t('ui.completed')}</LegendItem>
        </div>
      </CardBody>
    </DashboardCard>
  );
}
