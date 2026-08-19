import type { Task, TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DetailRow from '../UI/DetailRow';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import { useDurationPrediction } from '../../hooks/useDurationPrediction';

interface TaskDetailViewProps {
  task: Task;
  taskTypes?: TaskTypeOption[];
  academicTaskTypes?: AcademicTaskTypeOption[];
}

export default function TaskDetailView({ task, taskTypes = [], academicTaskTypes = [] }: TaskDetailViewProps) {
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
      <DetailRow label="Title">{task.title}</DetailRow>
      <DetailRow label="Date">{new Date(task.date).toLocaleDateString()}</DetailRow>
      <DetailRow label="Area">{task.area?.name ?? 'No Area'}</DetailRow>

      <DetailRow label="Status">
        <StatusBadge status={task.progressStatus} />
      </DetailRow>
      <DetailRow label="Difficulty">
        <DifficultyBadge difficulty={task.difficulty} />
      </DetailRow>

      <DetailRow label="Type">{typeLabel}</DetailRow>
      {academicTypeLabel && <DetailRow label="Academic Type">{academicTypeLabel}</DetailRow>}
      {task.topics && <DetailRow label="Topics">{task.topics}</DetailRow>}
      {task.notes && (
        <DetailRow label="Notes">
          <span className="whitespace-pre-wrap">{task.notes}</span>
        </DetailRow>
      )}

      {task.referenceLink && (
        <DetailRow label="Reference Link">
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
        <DetailRow label="Weight">{task.weightPercentage}%</DetailRow>
      )}
      {(task.estimatedMinutes != null || durationInfo?.actualMinutes != null) && (
        <DetailRow label="Duration">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {task.estimatedMinutes != null && <span>Estimated: {task.estimatedMinutes} min</span>}
            {durationInfo?.actualMinutes != null && (
              <span>Actual: {durationInfo.actualMinutes} min</span>
            )}
          </div>
        </DetailRow>
      )}
      {task.targetGrade != null && (
        <DetailRow label="Target Grade">{task.targetGrade}</DetailRow>
      )}
      <DetailRow label="Real Grade">
        {task.realGrade != null ? (
          task.realGrade
        ) : (
          <span className="text-neutral-500">Not entered yet</span>
        )}
      </DetailRow>

      <DetailRow label="Google Calendar">
        {task.googleCalendarEventId ? (
          <span className="inline-flex items-center gap-1.5 text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Synced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            Not synced
          </span>
        )}
      </DetailRow>
    </div>
  );
}
