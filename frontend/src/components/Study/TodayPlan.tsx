import { useTodayPlan } from '../../hooks/useTodayPlan';
import DifficultyBadge from '../UI/DifficultyBadge';
import PriorityBadge from '../UI/PriorityBadge';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';

export default function TodayPlan() {
  const { tasks, isLoading, error } = useTodayPlan();

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Today's plan</h2>

      {isLoading && <LoadingState message="Loading today's tasks..." />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && tasks.length === 0 && (
        <EmptyState message="No tasks due today." />
      )}

      {!isLoading && !error && tasks.length > 0 && (
        <ol className="flex flex-col gap-2">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className="flex items-center gap-3 border border-neutral-800 rounded-lg px-3 py-2.5"
            >
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-violet-900/40 text-violet-300 text-xs font-bold">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{task.title}</p>
                {task.weightPercentage != null && (
                  <p className="text-xs text-neutral-500">
                    {task.weightPercentage}% of final grade
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {task.priority && (
                  <PriorityBadge label={task.priorityLabel ?? task.priority} colorHex={task.priorityColorHex} />
                )}
                <DifficultyBadge difficulty={task.difficulty} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
