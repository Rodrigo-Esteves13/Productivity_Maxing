import type { Task, TaskTypeOption, AcademicTaskTypeOption, Subtask } from '../../types/models';
import SubtaskChecklist from './SubtaskChecklist';
import TaskAttachmentsSection from './TaskAttachmentsSection';
import StatusBadge from '../UI/StatusBadge';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import DifficultyBadge from '../UI/DifficultyBadge';
import TaskReadinessBadges from '../UI/TaskReadinessBadges';
import PriorityBadge from '../UI/PriorityBadge';
import DetailRow from '../UI/DetailRow';
import { recurrenceLabel } from '../../lib/recurrence';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import { useDurationPrediction } from '../../hooks/useDurationPrediction';
import { useI18n } from '../../i18n/useI18n';
import { formatTaskDue } from '../../lib/taskReadiness';
import { formatTaskDate } from '../../lib/timeFormat';
import { askIfFinishedOnTime, canReviewOnTime } from '../../lib/onTimeQuestion';
import { wasCompletedOnTime } from '../../utils/deadlineCompliance';

// O que conta hoje para "Deadlines met": a resposta da pessoa ou, sem ela,
// o dia em que marcou como feito.
function onTimeStatusKey(task: Task): string {
  if (task.submissionOnTime === false) return 'onTime.answeredNo';
  if (task.onTime != null) return task.onTime ? 'onTime.answeredYes' : 'onTime.answeredNo';
  return wasCompletedOnTime(task) === false ? 'onTime.computedLate' : 'onTime.computedOnTime';
}

interface TaskDetailViewProps {
  task: Task;
  taskTypes?: TaskTypeOption[];
  academicTaskTypes?: AcademicTaskTypeOption[];
  // Sem isto a checklist nao aparece (usos so de leitura do detalhe).
  onSubtasksChange?: (taskId: string, subtasks: Subtask[]) => void;
  // Chamado quando um passo e promovido a task propria.
  onSubtaskConverted?: (task: Task) => void;
}

export default function TaskDetailView({ task, taskTypes = [], academicTaskTypes = [], onSubtasksChange, onSubtaskConverted }: TaskDetailViewProps) {
  const { t, lang } = useI18n();
  const enumLabel = useEnumLabel();
  const { optionLabel } = useCatalogLabel();
  const typeLabel = optionLabel('taskType', task.type, taskTypes);
  const academicTypeLabel = optionLabel('academicType', task.academicType, academicTaskTypes);
  // Reutiliza o mesmo hook do formulário só para ir buscar actualMinutes
  // (soma real das StudySessions desta task) - o predictedMinutes que
  // ele também devolve não é mostrado aqui, o detail view só quer
  // Estimado vs Real, não uma sugestão para editar.
  const { prediction: durationInfo } = useDurationPrediction({
    type: task.type,
    academicType: task.academicType ?? '',
    difficulty: task.difficulty,
    weightPercentage: task.weightPercentage != null ? String(task.weightPercentage) : '',
    taskId: task.id,
    areaId: task.areaId,
  });
  return (
    <div>
      <DetailRow label={t('ui.title')}>{task.title}</DetailRow>
      <DetailRow label={t('ui.date')}>
        <div className="flex items-center gap-2">
          <span>{formatTaskDue(task, lang)}</span>
          <TaskReadinessBadges task={{ ...task, effort: null }} />
          {task.postponedCount > 0 && (
            <span className="text-xs text-amber-500/80">
              {t('ui.postponedX', { postponedCount: task.postponedCount })}</span>
          )}
        </div>
      </DetailRow>
      {task.submissionDate && (
        <DetailRow label={t('twoPhase.handInDate')}>
          <span>{formatTaskDate(task.submissionDate, lang)}</span>
          {task.submissionOnTime !== null && task.submissionOnTime !== undefined && (
            <span className="ml-2 text-xs text-neutral-400">
              {t(task.submissionOnTime ? 'onTime.answeredYes' : 'onTime.answeredNo')}
            </span>
          )}
        </DetailRow>
      )}
      {canReviewOnTime(task) ? (
        <DetailRow label={t('onTime.title')}>
          <span>{t(onTimeStatusKey(task))}</span>
          <button
            type="button"
            onClick={() => askIfFinishedOnTime([task])}
            className="ml-2 text-xs font-medium text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline"
          >
            {t(task.onTime != null || task.submissionOnTime != null ? 'onTime.change' : 'onTime.answer')}
          </button>
        </DetailRow>
      ) : (
        task.onTime != null && (
          <DetailRow label={t('onTime.title')}>
            {t(task.onTime ? 'onTime.answeredYes' : 'onTime.answeredNo')}
          </DetailRow>
        )
      )}
      {onSubtasksChange && (
        <DetailRow label={t('ui.checklist')}>
          <SubtaskChecklist
            taskId={task.id}
            subtasks={task.subtasks ?? []}
            onChange={(next) => onSubtasksChange(task.id, next)}
            onConverted={onSubtaskConverted}
          />
        </DetailRow>
      )}
      {onSubtasksChange && (
        <DetailRow label={t('taskFiles.title')}>
          <TaskAttachmentsSection taskId={task.id} />
        </DetailRow>
      )}
      {recurrenceLabel(task) && (
        <DetailRow label={t('ui.repeat')}>
          {recurrenceLabel(task)}
          {task.recurrenceUntil ? ` ${t('ui.recurrenceUntil', { date: new Date(task.recurrenceUntil).toLocaleDateString() })}` : ''}.{' '}
          {t('ui.nextOneCreatedOnComplete')}
        </DetailRow>
      )}
      <DetailRow label={t('ui.area')}>{task.area?.name ?? t('ui.noArea2')}</DetailRow>

      <DetailRow label={t('ui.status')}>
        <StatusBadge status={task.progressStatus} />
      </DetailRow>
      <DetailRow label={t('ui.difficulty')}>
        <DifficultyBadge difficulty={task.difficulty} />
      </DetailRow>
      <DetailRow label={t('readiness.effort')}>
        {task.effort ? enumLabel(task.effort) : t('readiness.effortNotSet')}
      </DetailRow>
      {task.priority && (
        <DetailRow label={t('ui.priority')}>
          <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
        </DetailRow>
      )}

      <DetailRow label={t('ui.type')}>{typeLabel}</DetailRow>
      {academicTypeLabel && <DetailRow label={t('ui.academicType')}>{academicTypeLabel}</DetailRow>}
      {task.topics && <DetailRow label={t('ui.topics')}>{task.topics}</DetailRow>}
      {task.tags?.length ? <DetailRow label={t('tags.label')}>{task.tags.map((tag) => `#${tag}`).join(' ')}</DetailRow> : null}
      {task.notes && (
        <DetailRow label={t('ui.notes')}>
          <span className="whitespace-pre-wrap break-words">{task.notes}</span>
        </DetailRow>
      )}

      {task.referenceLink && (
        <DetailRow label={t('ui.referenceLink')}>
          <a
            href={task.referenceLink}
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 hover:text-violet-300 underline break-all"
          >
            {task.referenceLink}
          </a>
        </DetailRow>
      )}

      {task.weightPercentage != null && (
        <DetailRow label={t('ui.weight')}>{task.weightPercentage}%</DetailRow>
      )}
      {(task.estimatedMinutes != null || durationInfo?.actualMinutes != null) && (
        <DetailRow label={t('ui.duration')}>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {task.estimatedMinutes != null && <span>{t('ui.estimatedMin', { estimatedMinutes: task.estimatedMinutes })}</span>}
            {durationInfo?.actualMinutes != null && (
              <span>{t('ui.actualMin', { actualMinutes: durationInfo.actualMinutes })}</span>
            )}
          </div>
        </DetailRow>
      )}
      {task.targetGrade != null && (
        <DetailRow label={t('ui.targetGrade')}>{task.targetGrade}</DetailRow>
      )}
      <DetailRow label={t('ui.realGrade')}>
        {task.realGrade != null ? (
          task.realGrade
        ) : (
          <span className="text-neutral-500">{t('ui.notEnteredYet')}</span>
        )}
      </DetailRow>

      <DetailRow label={t('ui.googleCalendar')}>
        {task.googleCalendarEventId ? (
          <span className="inline-flex items-center gap-1.5 text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {t('ui.synced')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            {t('ui.notSynced')}
          </span>
        )}
      </DetailRow>
    </div>
  );
}
