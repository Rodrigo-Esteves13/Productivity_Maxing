import { useState } from 'react';
import { PlusIcon } from '../../UI/Icons';
import EventForm from './EventForm';
import ShiftList from './ShiftList';
import type { Commitment, CreateWorkShiftInput, UpdateWorkShiftInput, WorkShift } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';

interface EventsSectionProps {
  // Turnos sem local: eventos unicos e turnos antigos criados antes de haver locais.
  shifts: WorkShift[];
  commitments: Commitment[];
  isSaving: boolean;
  onAdd: (shifts: CreateWorkShiftInput[]) => Promise<boolean>;
  onEdit: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export default function EventsSection({ shifts, commitments, isSaving, onAdd, onEdit, onDelete }: EventsSectionProps) {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="text-base font-semibold text-white">{t('ui.oneOffEvents')}</h3>
      <p className="mb-3 text-xs text-neutral-500">
        {t('ui.thingsThatHappenOnceLike')}
      </p>

      <ShiftList
        shifts={shifts}
        isSaving={isSaving}
        onEdit={onEdit}
        onDelete={onDelete}
        onReplicate={onAdd}
        moveTargets={commitments}
        showTitle
      />

      {isAdding ? (
        <div className="mt-3">
          <EventForm
            isSaving={isSaving}
            onSubmit={async (input) => {
              const ok = await onAdd([input]);
              if (ok) setIsAdding(false);
              return ok;
            }}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="mt-3 flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300"
        >
          <PlusIcon />
          Add event
        </button>
      )}
    </section>
  );
}
