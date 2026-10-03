import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { getDateStatus } from '../../utils/taskDateStatus';
import StatusBadge from '../UI/StatusBadge';
import { AlertTriangleIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { useAreaLookup } from '../../hooks/useAreaLookup';

interface AtRiskTasksCardProps {
  tasks: Task[];
  areas: Area[];
}

// "At risk" = overdue and not done, OR explicitly flagged BEHIND/VERY_BEHIND
// by the user regardless of date - the two signals don't always overlap
// (a task can be behind schedule without technically being overdue yet).
export default function AtRiskTasksCard({ tasks, areas }: AtRiskTasksCardProps) {
  const areaById = useAreaLookup(areas);

  const atRisk = tasks
    .filter((t) => t.progressStatus !== 'COMPLETED')
    .filter(
      (t) =>
        getDateStatus(t) === 'overdue' ||
        t.progressStatus === 'BEHIND' ||
        t.progressStatus === 'VERY_BEHIND',
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  if (atRisk.length === 0) return null;

  return (
    <DashboardCard tone="danger">
      <CardHeading tone="danger" className="mb-3">
        <AlertTriangleIcon className="shrink-0" />
        At risk ({atRisk.length})
      </CardHeading>
      <ul className="space-y-2">
        {atRisk.map((task) => {
          const area = areaById.get(task.areaId);
          return (
            <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {area && (
                  <ColorDot size="xs" color={area.colorHex} />
                )}
                <span className="truncate text-neutral-200">{task.title}</span>
              </div>
              <StatusBadge status={task.progressStatus} />
            </li>
          );
        })}
      </ul>
      <Link
        to="/tasks"
        className="block mt-3 text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted"
      >
        View all tasks
      </Link>
    </DashboardCard>
  );
}
