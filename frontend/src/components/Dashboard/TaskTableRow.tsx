import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TaskTableRowProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
}

export default function TaskTableRow({ task, academicTaskTypes }: TaskTableRowProps) {
  // task.academicType é a `key` estável (ex: "TRABALHO_PRATICO", em
  // português por convenção - ver schema.prisma), não o texto para
  // mostrar. BUG CORRIGIDO: isto passava antes por formatEnumLabel, que só
  // faz Title Case à key em vez de ir buscar o `label` real (editável pelo
  // admin, em inglês) - por isso a coluna aparecia em português.
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">{new Date(task.date).toLocaleDateString()}</td>
      <td className="px-4 py-3 text-center">
        <DateStatusBadge status={getDateStatus(task)} />
        <div className="text-[11px] text-neutral-500 mt-1 whitespace-nowrap">
          {getRemainingTimeLabel(task)}
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-white">
        <div className="flex items-center gap-2">
          {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
          {task.area?.name || '—'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-neutral-200">{task.title}</div>
        {task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
      </td>
      {/* Esta página só mostra tasks Académicas (ver Dashboard.tsx), por
          isso o backend nunca deixa academicType ficar vazio aqui - não
          precisa de fallback condicional para "—", resolveOptionLabel já
          trata de um eventual null/key desconhecida. */}
      <td className="px-4 py-3 text-xs text-neutral-400">{academicTypeLabel}</td>
      <td className="px-4 py-3">{task.weightPercentage ? `${task.weightPercentage}%` : '—'}</td>
      <td className="px-4 py-3"><DifficultyBadge difficulty={task.difficulty} /></td>
      <td className="px-4 py-3 text-center"><StatusBadge status={task.progressStatus} /></td>
      <td className="px-4 py-3 text-center font-medium text-blue-400">{task.targetGrade ?? '—'}</td>
      <td className="px-4 py-3 text-center font-bold text-cyan-400">{task.realGrade ?? '—'}</td>
    </tr>
  );
}
