import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { GraduationCapIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { useAreaLookup } from '../../hooks/useAreaLookup';

interface ExamCountdownCardProps {
  tasks: Task[];
  areas: Area[];
}

const MAX_SHOWN = 4;

// "Days until my next graded thing" - narrower than UpcomingTasksCard
// (which is everything due in 7 days, regardless of whether it's graded).
// A graded evaluation is approximated as any pending task with
// weightPercentage set - the app has no separate "this is an exam" flag,
// and weight-toward-grade is the closest existing signal for "this one
// actually counts".
export default function ExamCountdownCard({ tasks, areas }: ExamCountdownCardProps) {
  const areaById = useAreaLookup(areas);

  const graded = tasks
    .filter((t) => t.progressStatus !== 'COMPLETED')
    .filter((t) => t.weightPercentage !== null && t.weightPercentage > 0)
    .filter((t) => new Date(t.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, MAX_SHOWN);

  if (graded.length === 0) return null;

  const next = graded[0];
  const nextArea = areaById.get(next.areaId);

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <GraduationCapIcon className="shrink-0" />
        Next graded evaluation
      </CardHeading>

      <div className="mb-3">
        <p className="text-2xl font-semibold text-violet-400">
          {getRemainingTimeLabel(next)}
        </p>
        <p className="text-sm text-neutral-300 truncate">
          {next.title}
          {nextArea && <span className="text-neutral-500"> - {nextArea.name}</span>}
        </p>
      </div>

      {graded.length > 1 && (
        <ul className="space-y-1.5 pt-2 border-t border-neutral-800">
          {graded.slice(1).map((task) => {
            const area = areaById.get(task.areaId);
            return (
              <li key={task.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {area && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: area.colorHex }}
                    />
                  )}
                  <span className="truncate text-neutral-400">{task.title}</span>
                </div>
                <span className="text-neutral-500 shrink-0">{getRemainingTimeLabel(task)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to="/tasks"
        className="block mt-3 text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted"
      >
        View all tasks
      </Link>
    </DashboardCard>
  );
}
