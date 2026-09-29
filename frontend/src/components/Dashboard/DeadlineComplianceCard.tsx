import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeDeadlineCompliance } from '../../utils/deadlineCompliance';
import { CheckIcon } from '../UI/Icons';

interface DeadlineComplianceCardProps {
  tasks: Task[];
}

const MIN_TASKS_TO_SHOW = 3;

// How often finished tasks were finished by their deadline, per month.
// Complements AtRiskTasksCard (what is late right now) with the
// historical view: is the habit improving or slipping.
export default function DeadlineComplianceCard({ tasks }: DeadlineComplianceCardProps) {
  const data = useMemo(() => computeDeadlineCompliance(tasks), [tasks]);

  if (data.total < MIN_TASKS_TO_SHOW) return null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
        <CheckIcon className="shrink-0" />
        Deadlines met
      </p>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-2xl font-semibold text-violet-400">{data.ratePct}%</span>
        <span className="text-xs text-neutral-500 pb-1">
          {data.onTime} of {data.total} finished on time, last 6 months
        </span>
      </div>

      <div className="flex items-end gap-2 h-20">
        {data.months.map((m) => (
          <div
            key={m.monthKey}
            className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
            title={
              m.total > 0
                ? `${m.label}: ${m.onTime}/${m.total} on time`
                : `${m.label}: nothing finished`
            }
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-sm ${
                  m.ratePct === null
                    ? 'bg-neutral-800'
                    : m.ratePct >= 80
                      ? 'bg-emerald-500'
                      : m.ratePct >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                }`}
                style={{ height: `${m.ratePct === null ? 4 : Math.max(m.ratePct, 6)}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
