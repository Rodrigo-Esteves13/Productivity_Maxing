import { useState } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import IconButton from '../UI/IconButton';
import LinesSkeleton from '../UI/LinesSkeleton';
import { BellIcon, PencilIcon, PlusIcon, TrashIcon } from '../UI/Icons';
import MedicationForm from './MedicationForm';
import { formatClock } from '../../lib/timeFormat';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import type { useMedications } from '../../hooks/useMedications';
import type { Medication, MedicationDaySlot } from '../../types/models';

interface MedicationsCardProps {
  meds: ReturnType<typeof useMedications>;
}

// null = nada aberto; 'new' = a adicionar; id = a editar esse.
type Editing = null | 'new' | string;

function DoseRow({ slot, onToggle }: { slot: MedicationDaySlot; onToggle: () => void }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-neutral-800/50 px-3 py-2">
        <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={slot.taken} onChange={onToggle} />
        <span className="font-mono text-sm tabular-nums text-neutral-400">{formatClock(slot.slotMinutes)}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${slot.taken ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {slot.name}
          {slot.dosage && <span className="text-neutral-500"> · {slot.dosage}</span>}
        </span>
      </label>
    </li>
  );
}

// Medicacao: checklist das tomas de hoje e gestao dos medicamentos.
export default function MedicationsCard({ meds }: MedicationsCardProps) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const [editing, setEditing] = useState<Editing>(null);

  const reportFailure = (ok: boolean) => {
    if (!ok) notify(t('wellbeing.meds.saveError'), 'error');
  };

  const handleDelete = async (medication: Medication) => {
    const ok = await confirm({
      title: t('wellbeing.meds.deleteTitle'),
      message: t('wellbeing.meds.deleteMessage', { name: medication.name }),
      confirmLabel: t('wellbeing.meds.delete'),
      tone: 'danger',
    });
    if (ok) reportFailure(await meds.remove(medication.id));
  };

  const closeOnSuccess = (ok: boolean) => {
    if (ok) setEditing(null);
    return ok;
  };

  return (
    <DashboardCard>
      <div className="mb-1 flex items-center justify-between gap-2">
        <CardHeading>{t('wellbeing.meds.title')}</CardHeading>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t('wellbeing.meds.add')}
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500">{t('wellbeing.meds.disclaimer')}</p>

      {editing === 'new' && (
        <div className="mb-4">
          <MedicationForm
            isSaving={meds.isSaving}
            submitLabel={t('wellbeing.meds.add')}
            onSubmit={async (input) => closeOnSuccess(await meds.add(input))}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {meds.isLoading ? (
        <LinesSkeleton lines={3} />
      ) : meds.error ? (
        <ErrorState message={t('wellbeing.meds.loadError')} />
      ) : meds.medications.length === 0 ? (
        editing !== 'new' && <EmptyState variant="inline" message={t('wellbeing.meds.empty')} />
      ) : (
        <>
          <h3 className="mb-2 text-sm font-medium text-neutral-200">{t('wellbeing.meds.today')}</h3>
          {meds.slots.length === 0 ? (
            <EmptyState variant="inline" message={t('wellbeing.meds.nothingToday')} />
          ) : (
            <ul className="mb-5 space-y-1.5">
              {meds.slots.map((slot) => (
                <DoseRow
                  key={`${slot.medicationId}:${slot.slotMinutes}`}
                  slot={slot}
                  onToggle={() => void meds.toggleDose(slot).then(reportFailure)}
                />
              ))}
            </ul>
          )}

          <h3 className="mb-2 text-sm font-medium text-neutral-200">{t('wellbeing.meds.manage')}</h3>
          <ul className="space-y-1.5">
            {meds.medications.map((m) =>
              editing === m.id ? (
                <li key={m.id}>
                  <MedicationForm
                    initial={m}
                    isSaving={meds.isSaving}
                    submitLabel={t('common.save')}
                    onSubmit={async (input) => closeOnSuccess(await meds.update(m.id, input))}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 hover:bg-neutral-800/40">
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${m.active ? 'text-neutral-100' : 'text-neutral-500'}`}>
                      {m.name}
                      {m.dosage && <span className="text-neutral-500"> · {m.dosage}</span>}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-neutral-500">
                      {m.remindersEnabled && <BellIcon className="h-3 w-3" aria-label={t('wellbeing.meds.reminders')} />}
                      {m.times.map(formatClock).join(', ')}
                      {!m.active && ` · ${t('wellbeing.meds.paused')}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void meds.update(m.id, { active: !m.active }).then(reportFailure)}
                      className="px-1.5 text-xs text-neutral-400 hover:text-white"
                    >
                      {m.active ? t('wellbeing.meds.pause') : t('wellbeing.meds.resume')}
                    </button>
                    <IconButton label={t('wellbeing.meds.edit')} onClick={() => setEditing(m.id)}>
                      <PencilIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('wellbeing.meds.delete')} tone="danger" onClick={() => void handleDelete(m)}>
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
