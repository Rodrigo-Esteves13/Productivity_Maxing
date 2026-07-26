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
      setError('Could not load periods.');
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
      alert('Could not save the changes to this period.');
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
      await refreshContext();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409 && !forceConfirm) {
        // Most recent period in the program, no successor yet - ask for
        // explicit extra confirmation (see PeriodsService.archive).
        const message =
          err.response?.data?.message ??
          'This is the most recent period in this program, with no successor. Archive it anyway?';
        if (window.confirm(message)) {
          setBusyId(null);
          await toggleArchived(period, true);
          return;
        }
      } else {
        alert(
          err?.response?.data?.message ??
            "Could not change this period's archived status.",
        );
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
      alert('Could not pin/unpin this period.');
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
      setError('Could not create the period.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Periods - ${program.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">
          Organize "{program.name}" into semesters, years, or whatever periods make sense for it.
          Archived periods are still listed here, greyed out, with a Restore option. Pin one to
          make it the period this program opens by default, instead of always the most recent one.
        </p>

        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading...</p>
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
                      placeholder="Period name"
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
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => saveEditing(period)}
                        disabled={busyId === period.id || !editName.trim() || !editStart}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-100">
                        {period.isPinned && (
                          <span className="mr-1 inline-flex align-middle text-violet-400" title="Pinned">
                            <PinIcon />
                          </span>
                        )}
                        {period.name}
                        {period.isArchived && (
                          <span className="ml-2 text-xs text-neutral-500">(archived)</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(period.startDate).toLocaleDateString()}
                        {period.endDate
                          ? ` - ${new Date(period.endDate).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditing(period)}
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
                      >
                        Rename
                      </button>
                      {!period.isArchived && (
                        <button
                          type="button"
                          onClick={() => togglePin(period)}
                          disabled={busyId === period.id}
                          className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted disabled:opacity-50"
                        >
                          {period.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleArchived(period)}
                        disabled={busyId === period.id}
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted disabled:opacity-50"
                      >
                        {period.isArchived ? 'Restore' : 'Archive'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {periods.length === 0 && (
              <p className="text-sm text-neutral-500">No periods yet.</p>
            )}
          </ul>
        )}

        <form onSubmit={handleCreate} className="space-y-3 pt-3 border-t border-neutral-800">
          <p className="text-sm font-medium text-neutral-200">Add a new period</p>
          <FormField label="Name" htmlFor="new-period-name">
            <Input
              id="new-period-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="1st Semester 2025/26"
            />
          </FormField>
          <div className="flex gap-2">
            <FormField label="Start date" htmlFor="new-period-start" className="flex-1">
              <Input
                id="new-period-start"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </FormField>
            <FormField label="End date (optional)" htmlFor="new-period-end" className="flex-1">
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
              {isCreating ? 'Adding...' : 'Add period'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
