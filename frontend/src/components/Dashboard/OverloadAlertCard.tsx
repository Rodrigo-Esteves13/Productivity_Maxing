import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { detectOverloadWeek } from '../../utils/detectOverloadWeek';
import { AlertTriangleIcon } from '../UI/Icons';

interface OverloadAlertCardProps {
  tasks: Task[];
  areas: Area[];
}

// Counts how many of the window's tasks fall under each Area, for the
// small per-course breakdown under the headline count - "where" the load
// is concentrated is often more actionable than just "how many".
function countByArea(tasks: Task[], areas: Area[]): { area: Area; count: number }[] {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const counts = new Map<string, number>();
  for (const task of tasks) {
    counts.set(task.areaId, (counts.get(task.areaId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([areaId, count]) => ({ area: areaById.get(areaId), count }))
    .filter((row): row is { area: Area; count: number } => row.area !== undefined)
    .sort((a, b) => b.count - a.count);
}

export default function OverloadAlertCard({ tasks, areas }: OverloadAlertCardProps) {
  const overload = detectOverloadWeek(tasks);
  if (!overload) return null;

  const breakdown = countByArea(overload.tasks, areas);

  return (
    <div className="bg-neutral-900/50 border border-red-900/50 rounded-xl p-4 shadow-xl mb-6">
      <p className="text-xs uppercase tracking-wide text-red-400 mb-2 flex items-center gap-1.5">
        <AlertTriangleIcon className="shrink-0" />
        Heavy week ahead
      </p>
      <p className="text-sm text-neutral-200 mb-3">
        <span className="font-bold text-lg">{overload.tasks.length}</span> pending tasks are due in
        the next 7 days - more than usual, worth planning ahead for.
      </p>
      {breakdown.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {breakdown.map(({ area, count }) => (
            <li key={area.id} className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: area.colorHex }}
              />
              {area.name}: {count}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/tasks"
        className="text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted"
      >
        View all tasks
      </Link>
    </div>
  );
}
