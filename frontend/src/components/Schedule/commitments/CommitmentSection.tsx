import { useState } from 'react';
import { PencilIcon, PlusIcon, TrashIcon } from '../../UI/Icons';
import CommitmentForm from './CommitmentForm';
import ShiftForm from './ShiftForm';
import type { ShiftFormValues } from './ShiftForm';
import ShiftRow from './ShiftRow';
import type {
  CommitmentWithShifts,
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
} from '../../../types/models';
import IconButton from '../../UI/IconButton';
import InlineConfirm from '../../UI/InlineConfirm';

type Mode = 'view' | 'edit' | 'add-shift' | 'confirm-delete';

interface CommitmentSectionProps {
  commitment: CommitmentWithShifts;
  isSaving: boolean;
  onEditCommitment: (id: string, changes: { name?: string; commuteMinutes?: number }) => Promise<boolean>;
  onDeleteCommitment: (id: string) => Promise<boolean>;
  onAddShifts: (shifts: CreateWorkShiftInput[]) => Promise<boolean>;
  onEditShift: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDeleteShift: (id: string) => Promise<boolean>;
}

export default function CommitmentSection({
  commitment,
  isSaving,
  onEditCommitment,
  onDeleteCommitment,
  onAddShifts,
  onEditShift,
  onDeleteShift,
}: CommitmentSectionProps) {
  const [mode, setMode] = useState<Mode>('view');

  const handleAddShift = async (values: ShiftFormValues): Promise<boolean> => {
    const base = {
      commitmentId: commitment.id,
      startMinutes: values.startMinutes,
      endMinutes: values.endMinutes,
    };
    const inputs: CreateWorkShiftInput[] =
      values.repeat === 'weekly'
        ? values.days.map((dayOfWeek) => ({ ...base, dayOfWeek }))
        : [{ ...base, date: values.date }];
    const ok = await onAddShifts(inputs);
    if (ok) setMode('view');
    return ok;
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      {mode === 'edit' ? (
        <CommitmentForm
          initialName={commitment.name}
          initialCommute={commitment.commuteMinutes}
          submitLabel="Save"
          isSaving={isSaving}
          onSubmit={async (name, commuteMinutes) => {
            const ok = await onEditCommitment(commitment.id, { name, commuteMinutes });
            if (ok) setMode('view');
            return ok;
          }}
          onCancel={() => setMode('view')}
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white truncate">{commitment.name}</h3>
            <p className="text-xs text-neutral-500">
              {commitment.commuteMinutes > 0
                ? `${commitment.commuteMinutes} min travel each way`
                : 'No travel time'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton label={`Edit ${commitment.name}`} onClick={() => setMode('edit')}>
              <PencilIcon />
            </IconButton>
            <IconButton tone="danger" label={`Delete ${commitment.name}`} onClick={() => setMode('confirm-delete')}>
              <TrashIcon />
            </IconButton>
          </div>
        </div>
      )}

      {mode === 'confirm-delete' && (
        <InlineConfirm
          className="mt-3"
          message={`Delete ${commitment.name} and its ${commitment.shifts.length} shift(s)?`}
          confirmLabel="Yes, delete"
          isBusy={isSaving}
          onConfirm={() => void onDeleteCommitment(commitment.id)}
          onCancel={() => setMode('view')}
        />
      )}

      {commitment.shifts.length > 0 && (
        <ul className="space-y-1.5 mt-3">
          {commitment.shifts.map((shift) => (
            <ShiftRow
              key={shift.id}
              shift={shift}
              isSaving={isSaving}
              onEdit={onEditShift}
              onDelete={onDeleteShift}
            />
          ))}
        </ul>
      )}

      {mode === 'add-shift' ? (
        <div className="mt-3">
          <ShiftForm
            submitLabel="Add shift"
            isSaving={isSaving}
            onSubmit={handleAddShift}
            onCancel={() => setMode('view')}
          />
        </div>
      ) : (
        mode !== 'edit' && (
          <button
            type="button"
            onClick={() => setMode('add-shift')}
            className="mt-3 flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300"
          >
            <PlusIcon />
            Add shift
          </button>
        )
      )}
    </section>
  );
}
