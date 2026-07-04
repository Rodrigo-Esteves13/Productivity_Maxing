import type { Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DetailRow from '../UI/DetailRow';

interface TaskDetailViewProps {
  task: Task;
}

function formatEnumLabel(value: string | null): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function TaskDetailView({ task }: TaskDetailViewProps) {
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

      <DetailRow label="Type">{formatEnumLabel(task.type)}</DetailRow>
      {task.academicType && (
        <DetailRow label="Academic Type">{formatEnumLabel(task.academicType)}</DetailRow>
      )}
      {task.topics && <DetailRow label="Topics">{task.topics}</DetailRow>}

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
          <span className="inline-flex items-center gap-1.5 text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
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
