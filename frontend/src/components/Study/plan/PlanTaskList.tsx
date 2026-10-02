import { useState } from 'react';
import type { StudyPlanTask } from '../../../types/models';
import { PencilIcon } from '../../UI/Icons';
import EstimateEditor from './EstimateEditor';
import { formatDayLabel, formatDuration } from '../../../lib/timeFormat';
import { ESTIMATE_SOURCE_LABEL } from './planCopy';

interface PlanTaskListProps {
  tasks: StudyPlanTask[];
  calibrationFactor: number | null;
  onEstimateSaved: () => void;
}

function coveragePercent(task: StudyPlanTask): number {
  if (task.neededMinutes <= 0) return 100;
  return Math.min(100, Math.round((task.plannedMinutes / task.neededMinutes) * 100));
}

export default function PlanTaskList({ tasks, calibrationFactor, onEstimateSaved }: PlanTaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  if (tasks.length === 0) return null;

  return (
    <section aria-labelledby="plan-tasks-heading" className="mb-5">
      <h3
        id="plan-tasks-heading"
        className="text-xs uppercase tracking-wide text-neutral-500 mb-2"
      >
        Time needed per task
      </h3>
      <ul className="space-y-2">
        {tasks.map((task) => {
          const pct = coveragePercent(task);
          const isShort = task.shortfallMinutes > 0;
          return (
            <li key={task.taskId} className="rounded-lg bg-neutral-800/40 p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{task.title}</p>
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: task.areaColorHex }}
                    />
                    <span className="truncate">{task.areaName}</span>
                    <span>· due {formatDayLabel(task.deadline)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-neutral-200 flex items-center justify-end gap-1.5">
                    {formatDuration(task.neededMinutes)}
                    <button
                      type="button"
                      onClick={() => setEditingTaskId(task.taskId)}
                      aria-label={`Set time needed for ${task.title}`}
                      className="text-neutral-500 hover:text-white"
                    >
                      <PencilIcon />
                    </button>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {ESTIMATE_SOURCE_LABEL[task.estimateSource]}
                  </p>
                </div>
              </div>
              {editingTaskId === task.taskId && (
                <EstimateEditor
                  taskId={task.taskId}
                  currentMinutes={task.estimateMinutes}
                  onCancel={() => setEditingTaskId(null)}
                  onSaved={() => {
                    setEditingTaskId(null);
                    onEstimateSaved();
                  }}
                />
              )}
              <div
                className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${task.title} scheduled`}
              >
                <div
                  className={`h-full ${isShort ? 'bg-red-500' : 'bg-violet-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {(task.loggedMinutes > 0 || task.overtimeMinutes > 0 || isShort) && (
                <p className="text-xs text-neutral-500 mt-1.5">
                  {task.loggedMinutes > 0 && `${formatDuration(task.loggedMinutes)} already studied`}
                  {task.overtimeMinutes > 0 &&
                    `${task.loggedMinutes > 0 ? ' · ' : ''}${formatDuration(task.overtimeMinutes)} overtime`}
                  {isShort &&
                    `${task.loggedMinutes > 0 || task.overtimeMinutes > 0 ? ' · ' : ''}${formatDuration(task.shortfallMinutes)} unscheduled`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {calibrationFactor !== null && (
        <p className="text-xs text-neutral-500 mt-2">
          Based on your finished tasks, your estimates are scaled by {calibrationFactor.toFixed(2)}x.
        </p>
      )}
    </section>
  );
}
