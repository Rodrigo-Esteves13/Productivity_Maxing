import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import IconButton from '../UI/IconButton';
import LinesSkeleton from '../UI/LinesSkeleton';
import ToggleChip from '../UI/ToggleChip';
import { PencilIcon, PlaneIcon, PlusIcon, TrashIcon } from '../UI/Icons';
import { getCommitments } from '../../api/commitmentsService';
import {
  createScheduleException,
  deleteScheduleException,
  getScheduleExceptions,
  updateScheduleException,
} from '../../api/workShiftsService';
import { getApiMessage } from '../../lib/httpError';
import { formatClock, formatTaskDate, parseClock, weekdayLabel } from '../../lib/timeFormat';
import { lisbonTodayKey } from '../../lib/dateKey';
import { useI18n } from '../../i18n/useI18n';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { useFeedback } from '../../context/useFeedback';
import type {
  CommitmentsOverview,
  CreateScheduleExceptionInput,
  ScheduleException,
  WorkShift,
} from '../../types/models';

interface ScheduleChangesCardProps {
  refreshKey: number;
  /** Depois de gravar ou apagar: grelha, plano e Google Calendar. */
  onChanged: () => void;
}

const ALL_WORK = '';
const MAX_NOTE = 120;

// O pedido que recria (ou altera) uma mudanca ja gravada.
const toInput = (e: ScheduleException): CreateScheduleExceptionInput => ({
  kind: e.kind,
  ...(e.shiftId && { shiftId: e.shiftId }),
  ...(e.commitmentId && { commitmentId: e.commitmentId }),
  startsOn: e.startsOn.slice(0, 10),
  endsOn: e.endsOn.slice(0, 10),
  ...(e.startMinutes !== null && { startMinutes: e.startMinutes }),
  ...(e.endMinutes !== null && { endMinutes: e.endMinutes }),
  ...(e.note && { note: e.note }),
});

// Folgas, ferias e mudancas de hora do horario semanal, num so sitio: a
// lista do que esta marcado (para editar ou apagar) e um atalho para ferias. Mudar
// um so dia faz-se a partir do turno na grelha semanal.
export default function ScheduleChangesCard({ refreshKey, onChanged }: ScheduleChangesCardProps) {
  const { t, lang } = useI18n();
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [places, setPlaces] = useState<CommitmentsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [target, setTarget] = useState(ALL_WORK);
  // Preenchidos ao abrir o formulario (nao na montagem): depois da meia-noite
  // a pagina aberta ainda ia propor o dia anterior.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  // A mudanca em edicao (null = formulario de uma nova).
  const [editing, setEditing] = useState<ScheduleException | null>(null);
  // Horas "HH:MM", so usadas ao editar uma nova hora (RETIME).
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const isRetime = editing?.kind === 'RETIME';
  // Um turno concreto ou uma nova hora mantem o alvo; so a folga o escolhe.
  const canPickTarget = !editing || (!editing.shiftId && !isRetime);
  const [isSaving, setIsSaving] = useState(false);
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();

  const load = useCallback(async () => {
    try {
      const [list, overview] = await Promise.all([getScheduleExceptions(), getCommitments()]);
      setExceptions(list);
      setPlaces(overview);
      setError('');
    } catch {
      setError(t('scheduleChanges.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const shiftsById = useMemo(() => {
    const map = new Map<string, WorkShift>();
    for (const place of places?.commitments ?? []) for (const shift of place.shifts) map.set(shift.id, shift);
    for (const shift of places?.ungroupedShifts ?? []) map.set(shift.id, shift);
    return map;
  }, [places]);
  const placeName = (id: string | null) => places?.commitments.find((c) => c.id === id)?.name;

  const day = (iso: string) => formatTaskDate(iso, lang);
  const range = (e: ScheduleException) =>
    e.startsOn.slice(0, 10) === e.endsOn.slice(0, 10) ? day(e.startsOn) : `${day(e.startsOn)} - ${day(e.endsOn)}`;

  const describeTarget = (e: ScheduleException): string => {
    if (e.shiftId) {
      const shift = shiftsById.get(e.shiftId);
      const name = shift?.label ?? t('schedule.fallback.work');
      return shift?.dayOfWeek !== null && shift?.dayOfWeek !== undefined
        ? `${name} (${weekdayLabel(shift.dayOfWeek, lang)})`
        : name;
    }
    if (e.commitmentId) return placeName(e.commitmentId) ?? t('schedule.fallback.work');
    return t('scheduleChanges.allWork');
  };

  const openForm = () => {
    const today = lisbonTodayKey();
    setEditing(null);
    setTarget(ALL_WORK);
    setNote('');
    setFrom(today);
    setTo(today);
    setIsAdding(true);
  };

  const openEdit = (exception: ScheduleException) => {
    setEditing(exception);
    setTarget(exception.commitmentId ?? ALL_WORK);
    setNote(exception.note ?? '');
    setFrom(exception.startsOn.slice(0, 10));
    setTo(exception.endsOn.slice(0, 10));
    setStartTime(formatClock(exception.startMinutes ?? 0));
    setEndTime(formatClock(exception.endMinutes ?? 0));
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditing(null);
    setNote('');
  };

  // `to` acompanha `from`: o intervalo nunca fica ao contrario.
  const changeFrom = (value: string) => {
    setFrom(value);
    if (to < value) setTo(value);
  };

  // Apagar e logo, com toast "Anular" que recria a mudanca.
  const remove = async (exception: ScheduleException) => {
    try {
      await deleteScheduleException(exception.id);
    } catch (caught) {
      notify(getApiMessage(caught, t('shiftChange.failed')), 'error');
      return;
    }
    setExceptions((prev) => prev.filter((e) => e.id !== exception.id));
    if (editing?.id === exception.id) closeForm();
    onChanged();
    offerUndoDelete({
      message: t('ux4sched.change.deleted'),
      restore: () => createScheduleException(toInput(exception)),
      onRestored: () => {
        void load();
        onChanged();
      },
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (to < from) {
      notify(t('shiftChange.endBeforeStart'), 'error');
      return;
    }
    const startMinutes = parseClock(startTime);
    const endMinutes = parseClock(endTime);
    if (isRetime && (startMinutes === null || endMinutes === null || startMinutes >= endMinutes)) {
      notify(t('shiftChange.timeOrder'), 'error');
      return;
    }
    const input: CreateScheduleExceptionInput = {
      kind: editing?.kind ?? 'OFF',
      ...(editing?.shiftId && { shiftId: editing.shiftId }),
      ...(canPickTarget
        ? target !== ALL_WORK && { commitmentId: target }
        : editing?.commitmentId && { commitmentId: editing.commitmentId }),
      startsOn: from,
      endsOn: to,
      ...(isRetime && { startMinutes: startMinutes ?? 0, endMinutes: endMinutes ?? 0 }),
      note: note.trim() || undefined,
    };
    setIsSaving(true);
    try {
      await (editing ? updateScheduleException(editing.id, input) : createScheduleException(input));
      closeForm();
      notify(t('quickWins.shiftChangeSaved'), 'success');
      onChanged();
    } catch (caught) {
      notify(getApiMessage(caught, t('shiftChange.failed')), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const hasWeekly = shiftsById.size > 0;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-white">{t('scheduleChanges.title')}</h2>
          <p className="text-sm text-neutral-400">{t('scheduleChanges.description')}</p>
        </div>
        {!isAdding && hasWeekly && (
          <ActionButton onClick={openForm} className="flex shrink-0 items-center gap-2">
            <PlaneIcon aria-hidden="true" />
            {t('scheduleChanges.addTimeOff')}
          </ActionButton>
        )}
      </div>

      {isAdding && (
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-4 space-y-3 rounded-lg bg-neutral-800/40 p-3">
          {editing && (
            <h3 className="text-sm font-semibold text-white">
              {t('ux4global.change.editing', { target: describeTarget(editing) })}
            </h3>
          )}
          {canPickTarget && (
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-neutral-300">{t('shiftChange.appliesTo')}</legend>
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip size="sm" pressed={target === ALL_WORK} onClick={() => setTarget(ALL_WORK)}>
                  {t('scheduleChanges.allWork')}
                </ToggleChip>
                {places?.commitments.map((place) => (
                  <ToggleChip key={place.id} size="sm" pressed={target === place.id} onClick={() => setTarget(place.id)}>
                    {place.name}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
          )}
          {isRetime && (
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('shiftChange.newStart')} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input label={t('shiftChange.newEnd')} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('ui.from')} type="date" value={from} onChange={(e) => changeFrom(e.target.value)} />
            <Input label={t('ui.to')} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Input
            label={t('shiftChange.note')}
            value={note}
            maxLength={MAX_NOTE}
            placeholder={t('scheduleChanges.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <ActionButton type="submit" disabled={isSaving} className="flex items-center gap-2">
              {!editing && <PlusIcon aria-hidden="true" />}
              {isSaving ? t('common.saving') : t(editing ? 'common.save' : 'scheduleChanges.save')}
            </ActionButton>
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-2 text-sm text-neutral-400 hover:text-white pointer-coarse:min-h-11"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {isLoading && <LinesSkeleton lines={2} />}

      {!isLoading && !error && exceptions.length === 0 && (
        <EmptyState
          variant="inline"
          message={hasWeekly ? t('scheduleChanges.empty') : t('scheduleChanges.emptyNoWeekly')}
        />
      )}

      {exceptions.length > 0 && (
        <ul className="divide-y divide-neutral-800">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-neutral-100">
                  {e.kind === 'OFF'
                    ? t('scheduleChanges.kind.off')
                    : t('scheduleChanges.kind.retime', {
                        time: `${formatClock(e.startMinutes ?? 0)}-${formatClock(e.endMinutes ?? 0)}`,
                      })}
                  <span className="text-neutral-400"> · {describeTarget(e)}</span>
                </p>
                <p className="text-xs text-neutral-400">
                  <span className="tabular-nums">{range(e)}</span>
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <div className="-my-1 flex shrink-0 items-center">
                <IconButton label={t('ux4global.change.edit')} onClick={() => openEdit(e)}>
                  <PencilIcon />
                </IconButton>
                <IconButton
                  label={t('scheduleChanges.remove')}
                  onClick={() => void remove(e)}
                  className="text-neutral-500 hover:text-red-400"
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
