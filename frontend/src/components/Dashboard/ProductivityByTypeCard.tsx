import { useMemo } from 'react';
import type { Task, AcademicTaskTypeOption } from '../../types/models';
import { computeProductivityByType } from '../../utils/productivityByType';
import { ChartPieIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';

interface ProductivityByTypeCardProps {
  tasks: Task[];
  academicTaskTypes: AcademicTaskTypeOption[];
}

const MIN_TASKS_TO_SHOW = 5;

// Which kinds of work get finished, and on time, versus which ones slip.
// Same "on time" definition as DeadlineComplianceCard (shared helper).
export default function ProductivityByTypeCard({
  tasks,
  academicTaskTypes,
}: ProductivityByTypeCardProps) {
  const rows = useMemo(
    () => computeProductivityByType(tasks, academicTaskTypes),
    [tasks, academicTaskTypes],
  );
  if (tasks.length < MIN_TASKS_TO_SHOW || rows.length === 0) return null;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        Productivity by task type
      </CardHeading>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 text-left">
              <th className="font-normal pb-2 pr-2">Type</th>
              <th className="font-normal pb-2 px-2 text-right">Done</th>
              <th className="font-normal pb-2 px-2 text-right">On time</th>
              <th className="font-normal pb-2 pl-2 text-right">Avg grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row) => (
              <tr key={row.key} className="border-t border-neutral-800">
                <td className="py-1.5 pr-2 text-neutral-200 truncate max-w-[9rem]">{row.label}</td>
                <td className="py-1.5 px-2 text-right text-neutral-300">
                  {row.completed}/{row.total}
                  <span className="text-neutral-500"> ({row.completedPct}%)</span>
                </td>
                <td
                  className={`py-1.5 px-2 text-right ${
                    row.onTimePct === null
                      ? 'text-neutral-600'
                      : row.onTimePct >= 80
                        ? 'text-emerald-400'
                        : row.onTimePct >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                  }`}
                >
                  {row.onTimePct === null ? '-' : `${row.onTimePct}%`}
                </td>
                <td className="py-1.5 pl-2 text-right text-neutral-300">
                  {row.avgGrade === null ? '-' : row.avgGrade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
