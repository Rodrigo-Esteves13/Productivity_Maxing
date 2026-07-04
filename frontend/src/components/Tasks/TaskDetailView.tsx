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
      <DetailRow label="Título">{task.title}</DetailRow>
      <DetailRow label="Data">{new Date(task.date).toLocaleDateString()}</DetailRow>
      <DetailRow label="Área">{task.area?.name ?? 'Sem Área'}</DetailRow>

      <DetailRow label="Estado">
        <StatusBadge status={task.progressStatus} />
      </DetailRow>
      <DetailRow label="Dificuldade">
        <DifficultyBadge difficulty={task.difficulty} />
      </DetailRow>

      <DetailRow label="Tipo">{formatEnumLabel(task.type)}</DetailRow>
      {task.academicType && (
        <DetailRow label="Tipo Académico">{formatEnumLabel(task.academicType)}</DetailRow>
      )}
      {task.topics && <DetailRow label="Tópicos">{task.topics}</DetailRow>}

      {task.referenceLink && (
        <DetailRow label="Link de Referência">
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
        <DetailRow label="Peso">{task.weightPercentage}%</DetailRow>
      )}
      {task.targetGrade != null && (
        <DetailRow label="Nota Objetivo">{task.targetGrade}</DetailRow>
      )}
      <DetailRow label="Nota Real">
        {task.realGrade != null ? (
          task.realGrade
        ) : (
          <span className="text-neutral-500">Ainda não lançada</span>
        )}
      </DetailRow>

      <DetailRow label="Google Calendar">
        {task.googleCalendarEventId ? (
          <span className="inline-flex items-center gap-1.5 text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Sincronizado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
            Não sincronizado
          </span>
        )}
      </DetailRow>
    </div>
  );
}
