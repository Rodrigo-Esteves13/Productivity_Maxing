import { useState } from 'react';
import type { StudyPlanTask } from '../../../types/models';
import { PencilIcon } from '../../UI/Icons';
import EstimateEditor from './EstimateEditor';
import { formatDayLabel, formatDuration } from '../../../lib/timeFormat';
import { ESTIMATE_SOURCE_LABEL } from './planCopy';
import ProgressBar from '../../UI/ProgressBar';
import ColorDot from '../../UI/ColorDot';
import { useI18n } from '../../../i18n/useI18n';
import { useIncrementalReveal } from '../../../hooks/useIncrementalReveal';

// Tarefas visiveis antes do "Show more": com 10+ tarefas a coluna do plano
// ficava mais alta que o resto do Schedule.
const TASKS_PER_PAGE = 4;

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
  const { t } = useI18n();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const { visibleCount, hasMore, canCollapse, showMore, collapse } = useIncrementalReveal(
    tasks.length,
    TASKS_PER_PAGE,
  );
  if (tasks.length === 0) return null;

  return (
    <section aria-labelledby="plan-tasks-heading" className="mb-5">
      <h3
        id="plan-tasks-heading"
        className="text-xs uppercase tracking-wide text-neutral-500 mb-2"
      >
        {t('ui.timeNeededPerTask')}
      </h3>
      <ul className="space-y-2">
        {tasks.slice(0, visibleCount).map((task) => {
          const pct = coveragePercent(task);
          const isShort = task.shortfallMinutes > 0;
          return (
            <li key={task.taskId} className="rounded-lg bg-neutral-800/40 p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{task.title}</p>
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <ColorDot size="xs" color={task.areaColorHex} />
                    <span className="truncate">{task.areaName}</span>
                    <span>{t('ui.due', { deadline: formatDayLabel(task.deadline) })}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-neutral-200 flex items-center justify-end gap-1.5">
                    {formatDuration(task.neededMinutes)}
                    <button
                      type="button"
                      onClick={() => setEditingTaskId(task.taskId)}
                      aria-label={t('ui.setTimeNeededFor', { title: task.title })}
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
              <ProgressBar
                className="mt-2"
                percent={pct}
                fillClassName={isShort ? 'bg-red-500' : 'bg-violet-500'}
                label={t('ui.taskScheduled', { title: task.title })}
              />
              {(task.loggedMinutes > 0 || task.overtimeMinutes > 0 || isShort) && (
                <p className="text-xs text-neutral-500 mt-1.5">
                  {task.loggedMinutes > 0 && t('ui.alreadyStudied', { duration: formatDuration(task.loggedMinutes) })}
                  {task.overtimeMinutes > 0 &&
                    `${task.loggedMinutes > 0 ? ' · ' : ''}${t('ui.durationOvertime', { duration: formatDuration(task.overtimeMinutes) })}`}
                  {isShort &&
                    `${task.loggedMinutes > 0 || task.overtimeMinutes > 0 ? ' · ' : ''}${t('ui.durationUnscheduled', { duration: formatDuration(task.shortfallMinutes) })}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {(hasMore || canCollapse) && (
        <div className="mt-2 flex items-center justify-center gap-4 text-sm">
          {hasMore && (
            <button type="button" onClick={showMore} className="text-violet-400 hover:text-violet-300">
              {t('ui.showMoreTasksLeft', { remaining: tasks.length - visibleCount })}
            </button>
          )}
          {canCollapse && (
            <button type="button" onClick={collapse} className="text-neutral-400 hover:text-neutral-200">
              {t('ui.showLess')}
            </button>
          )}
        </div>
      )}
      {calibrationFactor !== null && (
        <p className="text-xs text-neutral-500 mt-2">
          {t('ui.basedOnYourFinishedTasks', { calibrationFactor: calibrationFactor.toFixed(2) })}</p>
      )}
    </section>
  );
}
