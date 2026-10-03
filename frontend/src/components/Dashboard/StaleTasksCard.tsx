import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { AlertTriangleIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { useAreaLookup } from '../../hooks/useAreaLookup';
import { MS_PER_DAY } from '../../lib/timeConstants';

interface StaleTasksCardProps {
  tasks: Task[];
  areas: Area[];
}

const STALE_DAYS = 14;
const MAX_SHOWN = 6;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

// Tasks that have been sitting pending for a while with nobody touching
// them - easy to lose track of in a long backlog, unlike an overdue task
// (which at least surfaces itself once its date passes). "Touched" is
// Task.updatedAt (Prisma @updatedAt, bumped by ANY update - editing the
// title, moving the date, changing status, etc.), not just completion.
export default function StaleTasksCard({ tasks, areas }: StaleTasksCardProps) {
  const areaById = useAreaLookup(areas);

  const stale = tasks
    .filter((t) => t.progressStatus !== 'COMPLETED')
    .filter((t) => daysSince(t.updatedAt) >= STALE_DAYS)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, MAX_SHOWN);

  if (stale.length === 0) return null;

  return (
    <DashboardCard tone="warning">
      <CardHeading tone="warning" className="mb-3">
        <AlertTriangleIcon className="shrink-0" />
        Not touched in a while
      </CardHeading>
      <ul className="space-y-2">
        {stale.map((task) => {
          const area = areaById.get(task.areaId);
          return (
            <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {area && (
                  <ColorDot size="xs" color={area.colorHex} />
                )}
                <span className="truncate text-neutral-200">{task.title}</span>
              </div>
              <span className="text-xs text-amber-500/80 shrink-0">
                {daysSince(task.updatedAt)}d ago
              </span>
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
