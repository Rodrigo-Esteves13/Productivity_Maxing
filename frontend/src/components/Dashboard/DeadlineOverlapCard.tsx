import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { detectDeadlineOverlaps } from '../../utils/detectDeadlineOverlaps';
import { CalendarIcon } from '../UI/Icons';

interface DeadlineOverlapCardProps {
  tasks: Task[];
  areas: Area[];
}

const GROUP_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
};

// dateKey is a bare YYYY-MM-DD (see detectDeadlineOverlaps) - parsed and
// formatted in UTC so the displayed day never shifts depending on the
// viewer's own timezone offset, same reasoning as toDateOnlyString on the
// backend's CalendarService.
function formatGroupDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', GROUP_DATE_FORMAT);
}

export default function DeadlineOverlapCard({ tasks, areas }: DeadlineOverlapCardProps) {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const overlaps = detectDeadlineOverlaps(tasks);

  if (overlaps.length === 0) return null;

  return (
    <div className="bg-neutral-900/50 border border-amber-900/50 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-amber-400 mb-3 flex items-center gap-1.5">
        <CalendarIcon className="shrink-0" />
        Deadline overlaps ({overlaps.length})
      </p>
      <ul className="space-y-3">
        {overlaps.map((group) => (
          <li key={group.dateKey}>
            <p className="text-xs text-neutral-500 mb-1">{formatGroupDate(group.dateKey)}</p>
            <ul className="space-y-1.5">
              {group.tasks.map((task) => {
                const area = areaById.get(task.areaId);
                return (
                  <li key={task.id} className="flex items-center gap-2 text-sm">
                    {area && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: area.colorHex }}
                      />
                    )}
                    <span className="truncate text-neutral-200">{task.title}</span>
                    {task.weightPercentage !== null && (
                      <span className="text-neutral-500 shrink-0">({task.weightPercentage}%)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <Link
        to="/tasks"
        className="block mt-3 text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted"
      >
        View all tasks
      </Link>
    </div>
  );
}
