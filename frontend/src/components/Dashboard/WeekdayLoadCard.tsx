import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeWeekdayDistribution } from '../../utils/weekdayDistribution';
import { CalendarIcon } from '../UI/Icons';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import LegendItem from '../UI/LegendItem';

interface WeekdayLoadCardProps {
  tasks: Task[];
}

const MIN_TASKS_TO_SHOW = 5;

// Which weekdays deadlines tend to pile up on. Pending and completed are
// stacked so a busy-but-already-done day doesn't look like a problem.
export default function WeekdayLoadCard({ tasks }: WeekdayLoadCardProps) {
  const buckets = useMemo(() => computeWeekdayDistribution(tasks), [tasks]);
  const total = buckets.reduce((s, b) => s + b.total, 0);
  if (total < MIN_TASKS_TO_SHOW) return null;

  const max = Math.max(...buckets.map((b) => b.total));
  const busiest = buckets.find((b) => b.total === max);

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <CalendarIcon className="shrink-0" />
        Deadlines by weekday
      </CardHeading>
      <CardBody>
        <p className="text-xs text-neutral-500 mb-3">
          Busiest: <span className="text-neutral-200">{busiest?.label}</span> ({max} of {total})
        </p>
        <div className="flex items-end gap-2 h-24">
          {buckets.map((b) => (
            <div
              key={b.label}
              className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              title={`${b.label}: ${b.pending} pending, ${b.completed} completed`}
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
          <LegendItem dotClassName="bg-violet-500">Pending</LegendItem>
          <LegendItem dotClassName="bg-neutral-700">Completed</LegendItem>
        </div>
      </CardBody>
    </DashboardCard>
  );
}
