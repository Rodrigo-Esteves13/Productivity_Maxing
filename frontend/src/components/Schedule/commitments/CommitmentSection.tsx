import { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { PencilIcon, PlusIcon, TrashIcon } from '../../UI/Icons';
import CommitmentForm from './CommitmentForm';
import ShiftForm from './ShiftForm';
import type { ShiftFormValues } from './ShiftForm';
import ShiftList from './ShiftList';
import { describeDaysOff } from './shiftText';
import type { CommitmentInput } from '../../../api/commitmentsService';
import type {
  CommitmentWithShifts,
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
} from '../../../types/models';
import IconButton from '../../UI/IconButton';
import InlineConfirm from '../../UI/InlineConfirm';

const CONTRACT_LINE_KEYS = {
  PERMANENT: 'commitment.contract.permanent',
  FIXED_TERM: 'commitment.contract.fixedTerm',
  INTERNSHIP: 'commitment.contract.internship',
} as const;

type Mode = 'view' | 'edit' | 'add-shift' | 'confirm-delete';

interface CommitmentSectionProps {
  commitment: CommitmentWithShifts;
  isSaving: boolean;
  onEditCommitment: (id: string, changes: Partial<CommitmentInput>) => Promise<boolean>;
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
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('view');

  const handleAddShift = async (values: ShiftFormValues): Promise<boolean> => {
    const base = {
      commitmentId: commitment.id,
      startMinutes: values.startMinutes,
      endMinutes: values.endMinutes,
    };
    const inputs: CreateWorkShiftInput[] =
      values.repeat === 'weekly'
        ? values.days.map((dayOfWeek) => ({ ...base, dayOfWeek, startsOn: values.startsOn }))
        : [{ ...base, date: values.date }];
    const ok = await onAddShifts(inputs);
    if (ok) setMode('view');
    return ok;
  };

  return (
    <section className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      {mode === 'edit' ? (
        <CommitmentForm
          initial={commitment}
          submitLabel={t('common.save')}
          isSaving={isSaving}
          onSubmit={async (values) => {
            const ok = await onEditCommitment(commitment.id, values);
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
                ? t('commitment.travelLine', { minutes: commitment.commuteMinutes })
                : t('commitment.noTravel')}
              {commitment.daysOff.length > 0 &&
                ` · ${t('commitment.daysOffLine', { days: describeDaysOff(commitment.daysOff) })}`}
            </p>
            {commitment.contractType && (
              <p className="text-xs text-neutral-500">
                {t(CONTRACT_LINE_KEYS[commitment.contractType])}
                {commitment.endsOn &&
                  ` · ${t('commitment.contract.until', {
                    date: new Date(commitment.endsOn).toLocaleDateString(undefined, { timeZone: 'UTC' }),
                  })}`}
              </p>
            )}
          </div>
          <div className="-my-1.5 -mr-2 flex items-center gap-1 shrink-0">
            <IconButton label={t('ui.editNamed', { name: commitment.name })} onClick={() => setMode('edit')}>
              <PencilIcon />
            </IconButton>
            <IconButton tone="danger" label={t('ui.deleteNamed', { name: commitment.name })} onClick={() => setMode('confirm-delete')}>
              <TrashIcon />
            </IconButton>
          </div>
        </div>
      )}

      {mode === 'confirm-delete' && (
        <InlineConfirm
          className="mt-3"
          message={t('ui.deleteCommitmentAndShifts', { name: commitment.name, count: commitment.shifts.length })}
          confirmLabel={t('ui.yesDelete')}
          isBusy={isSaving}
          onConfirm={() => void onDeleteCommitment(commitment.id)}
          onCancel={() => setMode('view')}
        />
      )}

      <ShiftList
        className="mt-3 mb-3"
        shifts={commitment.shifts}
        daysOff={commitment.daysOff}
        isSaving={isSaving}
        onEdit={onEditShift}
        onDelete={onDeleteShift}
        onReplicate={onAddShifts}
      />

      {mode === 'add-shift' ? (
        <div className="mt-3">
          <ShiftForm
            submitLabel={t('ui.addShift')}
            disabledDays={commitment.daysOff}
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
            className="press -mb-1.5 -ml-2 mt-auto flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          >
            <PlusIcon />
            {t('ui.addShift')}
          </button>
        )
      )}
    </section>
  );
}
