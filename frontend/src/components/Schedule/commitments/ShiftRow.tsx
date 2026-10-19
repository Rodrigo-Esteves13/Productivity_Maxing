import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import ReplicateShiftPanel from './ReplicateShiftPanel';
import ShiftForm from './ShiftForm';
import type { ShiftFormValues } from './ShiftForm';
import { describeShift } from './shiftText';
import type { Commitment, CreateWorkShiftInput, UpdateWorkShiftInput, WorkShift } from '../../../types/models';
import IconButton from '../../UI/IconButton';
import { useI18n } from '../../../i18n/useI18n';

interface ShiftRowProps {
  shift: WorkShift;
  // Folgas fixas do local deste turno.
  daysOff?: number[];
  isSaving: boolean;
  onEdit: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  // Copiar o turno para outros dias (mesmas horas).
  onReplicate?: (shifts: CreateWorkShiftInput[]) => Promise<boolean>;
  // Só para turnos soltos: permite movê-los para um local.
  moveTargets?: Commitment[];
  // Mostra o titulo do turno (eventos soltos) acima da data e hora.
  showTitle?: boolean;
}

export default function ShiftRow({
  shift,
  daysOff = [],
  isSaving,
  onEdit,
  onDelete,
  onReplicate,
  moveTargets,
  showTitle = false,
}: ShiftRowProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplicating, setIsReplicating] = useState(false);
  const isSkippedByDayOff = shift.dayOfWeek !== null && daysOff.includes(shift.dayOfWeek);
  // Mover para um local em que este dia e folga deixaria o turno escondido.
  const availableTargets = (moveTargets ?? []).filter(
    (c) => shift.dayOfWeek === null || !c.daysOff.includes(shift.dayOfWeek),
  );

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
          disabledDays={daysOff}
          submitLabel="Save"
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg bg-neutral-800/60 px-3 py-2">
     <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {showTitle && shift.label && (
          <p className="truncate text-sm font-medium text-white">{shift.label}</p>
        )}
        <p className={showTitle && shift.label ? 'text-xs text-neutral-400' : 'text-sm text-neutral-200'}>
          {describeShift(shift)}
        </p>
        {isSkippedByDayOff && (
          <p className="text-[11px] text-amber-400">{t('ui.fixedDayOffSkippedKept')}</p>
        )}
        {availableTargets.length > 0 && shift.dayOfWeek !== null && (
          <label className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
            Move to
            <select
              value=""
              onChange={(e) => e.target.value && void onEdit(shift.id, { commitmentId: e.target.value })}
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-300"
            >
              <option value="">{t('ui.choose')}</option>
              {availableTargets.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onReplicate && (
          <button
            type="button"
            onClick={() => setIsReplicating((open) => !open)}
            aria-expanded={isReplicating}
            className="px-2 py-1 text-xs text-violet-300 hover:text-violet-200 rounded"
            title={t('ui.copyThisShiftToOther')}
          >
            {t('ui.replicate')}
          </button>
        )}
        <IconButton label={t('ui.editShift')} onClick={() => setIsEditing(true)}>
          <PencilIcon />
        </IconButton>
        <IconButton tone="danger" label={t('ui.deleteShift')} onClick={() => void onDelete(shift.id)}>
          <TrashIcon />
        </IconButton>
      </div>
     </div>
     {isReplicating && onReplicate && (
       <ReplicateShiftPanel
         shift={shift}
         disabledDays={daysOff}
         isSaving={isSaving}
         onReplicate={onReplicate}
         onClose={() => setIsReplicating(false)}
       />
     )}
    </li>
  );
}
