import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import {
  getProgramPeriods,
  createPeriod,
  updatePeriod,
  archivePeriod,
  restorePeriod,
  togglePeriodPin,
} from '../../api/academicService';
import { useAcademic } from '../../context/useAcademic';
import { PinIcon } from '../UI/Icons';
import type { AcademicPeriod, AcademicProgram } from '../../types/models';
import { getApiMessage, getHttpStatus } from '../../lib/httpError';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface ManagePeriodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: AcademicProgram;
}

// Converts an ISO date string to the yyyy-mm-dd shape <input type="date">
// expects.
function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function ManagePeriodsModal({ isOpen, onClose, program }: ManagePeriodsModalProps) {
  const { t, lang } = useI18n();
  const { notify, confirm } = useFeedback();
  const { refresh: refreshContext } = useAcademic();
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadPeriods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProgramPeriods(program.id);
      setPeriods(data);
    } catch {
      setError(t('periods.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, program.id]);

  const startEditing = (period: AcademicPeriod) => {
    setEditingId(period.id);
    setEditName(period.name);
    setEditStart(toDateInputValue(period.startDate));
    setEditEnd(toDateInputValue(period.endDate));
  };

  const cancelEditing = () => setEditingId(null);

  const saveEditing = async (period: AcademicPeriod) => {
    if (!editName.trim() || !editStart) return;
    setBusyId(period.id);
    try {
      await updatePeriod(period.id, {
        name: editName.trim(),
        startDate: new Date(editStart).toISOString(),
        endDate: editEnd ? new Date(editEnd).toISOString() : null,
      });
      setEditingId(null);
      await loadPeriods();
      await refreshContext();
    } catch {
      notify(t('periods.saveError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchived = async (period: AcademicPeriod, forceConfirm = false) => {
    setBusyId(period.id);
    try {
      if (period.isArchived) {
        await restorePeriod(period.id);
      } else {
        await archivePeriod(period.id, forceConfirm);
      }
      await loadPeriods();
      // Arquivar o periodo ativo: o contexto passa para outro periodo ativo
      // (se nao for o ativo, leavePeriodId nao muda nada).
      await refreshContext(period.isArchived ? undefined : { leavePeriodId: period.id });
    } catch (err: unknown) {
      const status = getHttpStatus(err);
      if (status === 409 && !forceConfirm) {
        // Most recent period in the program, no successor yet - ask for
        // explicit extra confirmation (see PeriodsService.archive).
        const message = getApiMessage(
          err,
          t('period.archive.mostRecent'),
        );
        const confirmed = await confirm({
          title: t('period.archive.title'),
          message,
          confirmLabel: t('period.archive.anyway'),
        });
        if (confirmed) {
          setBusyId(null);
          await toggleArchived(period, true);
          return;
        }
      } else {
        notify(getApiMessage(err, t('periods.archiveStatusError')), 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  const togglePin = async (period: AcademicPeriod) => {
    setBusyId(period.id);
    try {
      await togglePeriodPin(period.id);
      await loadPeriods();
      await refreshContext();
    } catch {
      notify(t('periods.pinError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStart) return;

    setIsCreating(true);
    setError(null);
    try {
      await createPeriod({
        programId: program.id,
        name: newName.trim(),
        startDate: new Date(newStart).toISOString(),
        endDate: newEnd ? new Date(newEnd).toISOString() : undefined,
      });
      setNewName('');
      setNewStart('');
      setNewEnd('');
      await loadPeriods();
      await refreshContext();
    } catch {
      setError(t('periods.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('periods.modalTitle', { name: program.name })}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">
          {t('periods.intro', { name: program.name })}
        </p>

        {isLoading ? (
          <p className="text-sm text-neutral-500">{t('common.loading')}</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {periods.map((period) => (
              <li
                key={period.id}
                className={`rounded-lg border border-neutral-800 p-3 ${period.isArchived ? 'opacity-50' : ''}`}
              >
                {editingId === period.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('periods.namePlaceholder')}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="date"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={cancelEditing}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => saveEditing(period)}
                        disabled={busyId === period.id || !editName.trim() || !editStart}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-100">
                        {period.isPinned && (
                          <span className="mr-1 inline-flex align-middle text-violet-400" title={t('periods.pinned')}>
                            <PinIcon />
                          </span>
                        )}
                        {period.name}
                        {period.isArchived && (
                          <span className="ml-2 text-xs text-neutral-500">{t('period.archivedTag')}</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(period.startDate).toLocaleDateString(lang)}
                        {period.endDate
                          ? ` - ${new Date(period.endDate).toLocaleDateString(lang)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditing(period)}
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
                      >
                        {t('periods.rename')}
                      </button>
                      {!period.isArchived && (
                        <button
                          type="button"
                          onClick={() => togglePin(period)}
                          disabled={busyId === period.id}
                          className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted disabled:opacity-50"
                        >
                          {period.isPinned ? t('periods.unpin') : t('periods.pin')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleArchived(period)}
                        disabled={busyId === period.id}
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted disabled:opacity-50"
                      >
                        {period.isArchived ? t('periods.restore') : t('periods.archive')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {periods.length === 0 && (
              <p className="text-sm text-neutral-500">{t('periods.empty')}</p>
            )}
          </ul>
        )}

        <form onSubmit={handleCreate} className="space-y-3 pt-3 border-t border-neutral-800">
          <p className="text-sm font-medium text-neutral-200">{t('periods.addTitle')}</p>
          <FormField label={t('periods.name')} htmlFor="new-period-name">
            <Input
              id="new-period-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('periods.newPlaceholder')}
            />
          </FormField>
          <div className="flex gap-2">
            <FormField label={t('periods.start')} htmlFor="new-period-start" className="flex-1">
              <Input
                id="new-period-start"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </FormField>
            <FormField label={t('periods.end')} htmlFor="new-period-end" className="flex-1">
              <Input
                id="new-period-end"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </FormField>
          </div>

          {error && <FormError message={error} />}

          <div className="flex justify-end">
            <Button type="submit" disabled={isCreating || !newName.trim() || !newStart}>
              {isCreating ? t('periods.adding') : t('periods.add')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
