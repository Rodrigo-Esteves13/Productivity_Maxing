import type { Task, TaskTypeOption, AcademicTaskTypeOption, Subtask } from '../../types/models';
import SubtaskChecklist from './SubtaskChecklist';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import PriorityBadge from '../UI/PriorityBadge';
import DetailRow from '../UI/DetailRow';
import { recurrenceLabel } from '../../lib/recurrence';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import { useDurationPrediction } from '../../hooks/useDurationPrediction';
import { useI18n } from '../../i18n/useI18n';

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
  const { t } = useI18n();
  const typeLabel = resolveOptionLabel(task.type, taskTypes);
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);
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
  });
  return (
    <div>
      <DetailRow label={t('ui.title')}>{task.title}</DetailRow>
      <DetailRow label={t('ui.date')}>
        <div className="flex items-center gap-2">
          <span>{new Date(task.date).toLocaleDateString()}</span>
          {task.postponedCount > 0 && (
            <span className="text-xs text-amber-500/80">
              {t('ui.postponedX', { postponedCount: task.postponedCount })}</span>
          )}
        </div>
      </DetailRow>
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
      {task.priority && (
        <DetailRow label={t('ui.priority')}>
          <PriorityBadge label={task.priorityLabel ?? task.priority} colorHex={task.priorityColorHex} />
        </DetailRow>
      )}

      <DetailRow label={t('ui.type')}>{typeLabel}</DetailRow>
      {academicTypeLabel && <DetailRow label={t('ui.academicType')}>{academicTypeLabel}</DetailRow>}
      {task.topics && <DetailRow label={t('ui.topics')}>{task.topics}</DetailRow>}
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
