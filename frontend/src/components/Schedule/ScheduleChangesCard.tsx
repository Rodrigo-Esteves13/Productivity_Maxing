import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import IconButton from '../UI/IconButton';
import LinesSkeleton from '../UI/LinesSkeleton';
import ToggleChip from '../UI/ToggleChip';
import { PlaneIcon, PlusIcon, TrashIcon } from '../UI/Icons';
import { getCommitments } from '../../api/commitmentsService';
import {
  createScheduleException,
  deleteScheduleException,
  getScheduleExceptions,
} from '../../api/workShiftsService';
import { getApiMessage } from '../../lib/httpError';
import { formatClock, formatTaskDate, weekdayLabel } from '../../lib/timeFormat';
import { lisbonTodayKey } from '../../lib/dateKey';
import { useI18n } from '../../i18n/useI18n';
import type { CommitmentsOverview, ScheduleException, WorkShift } from '../../types/models';

interface ScheduleChangesCardProps {
  refreshKey: number;
  /** Depois de gravar ou apagar: grelha, plano e Google Calendar. */
  onChanged: () => void;
}

const ALL_WORK = '';
const MAX_NOTE = 120;

// Folgas, ferias e mudancas de hora do horario semanal, num so sitio: a
// lista do que esta marcado (para apagar) e um atalho para ferias. Mudar
// um so dia faz-se a partir do turno na grelha semanal.
export default function ScheduleChangesCard({ refreshKey, onChanged }: ScheduleChangesCardProps) {
  const { t, lang } = useI18n();
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [places, setPlaces] = useState<CommitmentsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [target, setTarget] = useState(ALL_WORK);
  const [from, setFrom] = useState(lisbonTodayKey());
  const [to, setTo] = useState(lisbonTodayKey());
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const remove = async (id: string) => {
    try {
      await deleteScheduleException(id);
      setExceptions((prev) => prev.filter((e) => e.id !== id));
      onChanged();
    } catch (caught) {
      setError(getApiMessage(caught, t('shiftChange.failed')));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (to < from) {
      setError(t('shiftChange.endBeforeStart'));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await createScheduleException({
        kind: 'OFF',
        ...(target !== ALL_WORK && { commitmentId: target }),
        startsOn: from,
        endsOn: to,
        note: note.trim() || undefined,
      });
      setIsAdding(false);
      setNote('');
      onChanged();
    } catch (caught) {
      setError(getApiMessage(caught, t('shiftChange.failed')));
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
          <ActionButton onClick={() => setIsAdding(true)} className="flex shrink-0 items-center gap-2">
            <PlaneIcon aria-hidden="true" />
            {t('scheduleChanges.addTimeOff')}
          </ActionButton>
        )}
      </div>

      {isAdding && (
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-4 space-y-3 rounded-lg bg-neutral-800/40 p-3">
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
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('ui.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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
              <PlusIcon aria-hidden="true" />
              {isSaving ? t('common.saving') : t('scheduleChanges.save')}
            </ActionButton>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-2 text-sm text-neutral-400 hover:text-white"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && <ErrorState message={error} />}
      {isLoading && <LinesSkeleton lines={2} />}

      {!isLoading && exceptions.length === 0 && (
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
              <IconButton
                label={t('scheduleChanges.remove')}
                onClick={() => void remove(e.id)}
                className="-my-1 shrink-0 text-neutral-500 hover:text-red-400"
              >
                <TrashIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
