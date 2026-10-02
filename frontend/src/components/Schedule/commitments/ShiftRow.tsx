import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import ShiftForm from './ShiftForm';
import type { ShiftFormValues } from './ShiftForm';
import { describeShift } from './shiftText';
import type { Commitment, UpdateWorkShiftInput, WorkShift } from '../../../types/models';

interface ShiftRowProps {
  shift: WorkShift;
  isSaving: boolean;
  onEdit: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  // Só para turnos soltos: permite movê-los para um local.
  moveTargets?: Commitment[];
}

export default function ShiftRow({ shift, isSaving, onEdit, onDelete, moveTargets }: ShiftRowProps) {
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
        <p className="text-sm text-neutral-200">{describeShift(shift)}</p>
        {moveTargets && moveTargets.length > 0 && (
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
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label="Edit shift"
          className="text-neutral-500 hover:text-white p-1 rounded-md"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={() => void onDelete(shift.id)}
          aria-label="Delete shift"
          className="text-neutral-500 hover:text-red-400 p-1 rounded-md"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}
