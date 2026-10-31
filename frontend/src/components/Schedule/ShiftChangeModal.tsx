import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import ToggleChip from '../UI/ToggleChip';
import { createScheduleException, deleteScheduleException } from '../../api/workShiftsService';
import { formatClock, formatTaskDate, parseClock } from '../../lib/timeFormat';
import { addUtcDays, startOfWeek } from '../../lib/weekDates';
import { toDateKey } from '../../lib/dateKey';
import { getApiMessage } from '../../lib/httpError';
import { useI18n } from '../../i18n/useI18n';
import type { ScheduleExceptionKind, WorkShiftOccurrence } from '../../types/models';

interface ShiftChangeModalProps {
  occurrence: WorkShiftOccurrence;
  onClose: () => void;
  /** Depois de gravar ou desfazer: a grelha e o plano refazem o fetch. */
  onChanged: () => void;
}

type Scope = 'shift' | 'place';
const MAX_NOTE = 120;

// Mexer num dia de um turno semanal sem mudar o turno para sempre: folga
// nesse dia, outra hora nesse dia ou numa semana, e (no local todo) ferias.
// Um turno que ja nao acontece (folga, feriado) ou que mudou de hora mostra
// so como desfazer.
export default function ShiftChangeModal({ occurrence, onClose, onChanged }: ShiftChangeModalProps) {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<ScheduleExceptionKind>('OFF');
  const [scope, setScope] = useState<Scope>('shift');
  const [from, setFrom] = useState(occurrence.date);
  const [to, setTo] = useState(occurrence.date);
  const [start, setStart] = useState(formatClock(occurrence.startMinutes));
  const [end, setEnd] = useState(formatClock(occurrence.endMinutes));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const label = occurrence.label ?? t('schedule.fallback.work');
  const dayLabel = formatTaskDate(`${occurrence.date}T00:00:00.000Z`, lang);
  const weekEnd = toDateKey(addUtcDays(startOfWeek(new Date(`${from}T00:00:00.000Z`)), 6));

  const save = async (input: Parameters<typeof createScheduleException>[0]) => {
    setIsSaving(true);
    setError('');
    try {
      await createScheduleException(input);
      onChanged();
      onClose();
    } catch (caught) {
      setError(getApiMessage(caught, t('shiftChange.failed')));
      setIsSaving(false);
    }
  };

  const undo = async () => {
    if (!occurrence.exceptionId) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteScheduleException(occurrence.exceptionId);
      onChanged();
      onClose();
    } catch (caught) {
      setError(getApiMessage(caught, t('shiftChange.failed')));
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (to < from) {
      setError(t('shiftChange.endBeforeStart'));
      return;
    }
    const target =
      scope === 'place' && occurrence.commitmentId
        ? { commitmentId: occurrence.commitmentId }
        : { shiftId: occurrence.shiftId };
    if (kind === 'RETIME') {
      const startMinutes = parseClock(start);
      const endMinutes = parseClock(end);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        setError(t('shiftChange.timeOrder'));
        return;
      }
      void save({ kind, ...target, startsOn: from, endsOn: to, startMinutes, endMinutes, note: note.trim() || undefined });
      return;
    }
    void save({ kind, ...target, startsOn: from, endsOn: to, note: note.trim() || undefined });
  };

  const title = t('shiftChange.title', { label, day: dayLabel });

  // Ja nao acontece ou ja mudou de hora: so desfazer (ou, no feriado,
  // trabalhar na mesma, que e uma "nova hora" igual a de sempre).
  if (occurrence.skipped || occurrence.retimed) {
    return (
      <Modal isOpen onClose={onClose} title={title}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            {occurrence.skipped === 'HOLIDAY'
              ? t('shiftChange.holidayInfo')
              : occurrence.skipped === 'OFF'
                ? t('shiftChange.offInfo')
                : t('shiftChange.retimedInfo', {
                    time: `${formatClock(occurrence.startMinutes)}-${formatClock(occurrence.endMinutes)}`,
                  })}
          </p>
          {error && <ErrorState message={error} />}
          <div className="flex flex-wrap gap-2">
            {occurrence.skipped === 'HOLIDAY' ? (
              <ActionButton
                disabled={isSaving}
                onClick={() =>
                  void save({
                    kind: 'RETIME',
                    shiftId: occurrence.shiftId,
                    startsOn: occurrence.date,
                    endsOn: occurrence.date,
                    startMinutes: occurrence.startMinutes,
                    endMinutes: occurrence.endMinutes,
                  })
                }
              >
                {t('shiftChange.workAnyway')}
              </ActionButton>
            ) : (
              <ActionButton disabled={isSaving} onClick={() => void undo()}>
                {t('shiftChange.undo')}
              </ActionButton>
            )}
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
              {t('common.cancel')}
            </button>
          </div>
          {occurrence.skipped === 'OFF' && <p className="text-xs text-neutral-500">{t('shiftChange.undoHint')}</p>}
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-300">{t('shiftChange.what')}</legend>
          <div className="flex flex-wrap gap-1.5">
            <ToggleChip size="sm" pressed={kind === 'OFF'} onClick={() => setKind('OFF')}>
              {t('shiftChange.kind.off')}
            </ToggleChip>
            <ToggleChip size="sm" pressed={kind === 'RETIME'} onClick={() => setKind('RETIME')}>
              {t('shiftChange.kind.retime')}
            </ToggleChip>
          </div>
        </fieldset>

        {occurrence.commitmentId && (
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-neutral-300">{t('shiftChange.appliesTo')}</legend>
            <div className="flex flex-wrap gap-1.5">
              <ToggleChip size="sm" pressed={scope === 'shift'} onClick={() => setScope('shift')}>
                {t('shiftChange.scope.shift')}
              </ToggleChip>
              <ToggleChip size="sm" pressed={scope === 'place'} onClick={() => setScope('place')}>
                {t('shiftChange.scope.place', { place: label })}
              </ToggleChip>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-300">{t('shiftChange.when')}</legend>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <ToggleChip size="sm" pressed={to === from} onClick={() => setTo(from)}>
              {t('shiftChange.onlyThisDay')}
            </ToggleChip>
            <ToggleChip size="sm" pressed={to === weekEnd && to !== from} onClick={() => setTo(weekEnd)}>
              {t('shiftChange.untilWeekEnd')}
            </ToggleChip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('ui.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label={t('ui.to')} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </fieldset>

        {kind === 'RETIME' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('shiftChange.newStart')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input label={t('shiftChange.newEnd')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}

        <Input
          label={t('shiftChange.note')}
          value={note}
          maxLength={MAX_NOTE}
          placeholder={t('shiftChange.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />

        <p className="text-xs text-neutral-500">{t('shiftChange.help')}</p>
        {error && <ErrorState message={error} />}
        <div className="flex gap-2">
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? t('common.saving') : t('shiftChange.save')}
          </ActionButton>
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
