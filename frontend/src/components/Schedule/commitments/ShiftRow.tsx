import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import ShiftForm from './ShiftForm';
import type { ShiftFormValues } from './ShiftForm';
import { describeShift } from './shiftText';
import type { Commitment, UpdateWorkShiftInput, WorkShift } from '../../../types/models';
import IconButton from '../../UI/IconButton';

interface ShiftRowProps {
  shift: WorkShift;
  isSaving: boolean;
  onEdit: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  // Só para turnos soltos: permite movê-los para um local.
  moveTargets?: Commitment[];
  // Mostra o titulo do turno (eventos soltos) acima da data e hora.
  showTitle?: boolean;
}

export default function ShiftRow({ shift, isSaving, onEdit, onDelete, moveTargets, showTitle = false }: ShiftRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = async (values: ShiftFormValues): Promise<boolean> => {
    // Enviar dayOfWeek OU date troca a recorrência (o servidor anula o outro).
    const ok = await onEdit(shift.id, {
      startMinutes: values.startMinutes,
      endMinutes: values.endMinutes,
      ...(values.repeat === 'weekly'
        ? { dayOfWeek: values.days[0] }
        : { date: values.date }),
    });
    if (ok) setIsEditing(false);
    return ok;
  };

  if (isEditing) {
    return (
      <li>
        <ShiftForm
          shift={shift}
          submitLabel="Save"
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-neutral-800/60 px-3 py-2">
      <div className="min-w-0">
        {showTitle && shift.label && (
          <p className="truncate text-sm font-medium text-white">{shift.label}</p>
        )}
        <p className={showTitle && shift.label ? 'text-xs text-neutral-400' : 'text-sm text-neutral-200'}>
          {describeShift(shift)}
        </p>
        {moveTargets && moveTargets.length > 0 && shift.dayOfWeek !== null && (
          <label className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
            Move to
            <select
              value=""
              onChange={(e) => e.target.value && void onEdit(shift.id, { commitmentId: e.target.value })}
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-300"
            >
              <option value="">Choose...</option>
              {moveTargets.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Edit shift" onClick={() => setIsEditing(true)}>
          <PencilIcon />
        </IconButton>
        <IconButton tone="danger" label="Delete shift" onClick={() => void onDelete(shift.id)}>
          <TrashIcon />
        </IconButton>
      </div>
    </li>
  );
}
