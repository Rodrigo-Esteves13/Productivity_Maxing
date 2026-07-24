import { Link } from 'react-router-dom';
import type { Task, Area } from '../../types/models';
import { getRemainingTimeLabel } from '../../utils/taskDateStatus';

interface UpcomingTasksCardProps {
  tasks: Task[];
  areas: Area[];
}

const WINDOW_DAYS = 7;

// Small glance card for "what's due soon", separate from the full
// TasksTable below it - the table has every task and every filter, this
// is just the next week at a glance, no scrolling needed.
export default function UpcomingTasksCard({ tasks, areas }: UpcomingTasksCardProps) {
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const now = Date.now();
  const windowEnd = now + WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const upcoming = tasks
    .filter((t) => t.progressStatus !== 'COMPLETED')
    .filter((t) => {
      const time = new Date(t.date).getTime();
      return time <= windowEnd; // includes anything already overdue too
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
        Next {WINDOW_DAYS} days
      </p>
      <ul className="space-y-2">
        {upcoming.map((task) => {
          const area = areaById.get(task.areaId);
          return (
            <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {area && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: area.colorHex }}
                  />
                )}
                <span className="truncate text-neutral-200">{task.title}</span>
              </div>
              <span className="text-xs text-neutral-500 shrink-0">
                {getRemainingTimeLabel(task)}
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
    </div>
  );
}
