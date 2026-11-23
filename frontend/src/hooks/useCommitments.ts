import { useCallback, useEffect, useState } from 'react';
import {
  createCommitment,
  type CommitmentInput,
  deleteCommitment,
  getCommitments,
  updateCommitment,
} from '../api/commitmentsService';
import {
  copyWeekShifts,
  createWorkShifts,
  deleteWorkShift,
  updateWorkShift,
} from '../api/workShiftsService';
import type {
  CommitmentsOverview,
  CopyWeekInput,
  CopyWeekResult,
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
  WorkShift,
} from '../types/models';
import { getHttpStatus, HTTP_CONFLICT } from '../lib/httpError';
import { translateNow } from '../i18n/translate';
import { useFeedback } from '../context/useFeedback';
import { useUndoableDelete } from './useUndoableDelete';

// Dados para recriar um turno apagado. Num local, o nome, a morada e a
// deslocacao vem do proprio local; num evento pontual vao no turno.
function shiftToInput(shift: WorkShift): CreateWorkShiftInput {
  const input: CreateWorkShiftInput = { startMinutes: shift.startMinutes, endMinutes: shift.endMinutes };
  if (shift.dayOfWeek !== null) input.dayOfWeek = shift.dayOfWeek;
  if (shift.date) input.date = shift.date.slice(0, 10);
  if (shift.startsOn) input.startsOn = shift.startsOn.slice(0, 10);
  if (shift.commitmentId) {
    input.commitmentId = shift.commitmentId;
    return input;
  }
  input.bufferMinutes = shift.bufferMinutes;
  if (shift.label) input.label = shift.label;
  if (shift.address) input.address = shift.address;
  if (shift.commuteMode) input.commuteMode = shift.commuteMode;
  return input;
}

const EMPTY: CommitmentsOverview = { commitments: [], ungroupedShifts: [] };

// Qualquer alteração a locais/turnos muda o plano de estudo, a grelha e o
// que o Google Calendar devia ter: `onChanged` avisa quem precisa de refazer.
export function useCommitments(onChanged: () => void) {
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
  const [overview, setOverview] = useState<CommitmentsOverview>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [copyResult, setCopyResult] = useState<CopyWeekResult | null>(null);

  const refetch = useCallback(async () => {
    try {
      setOverview(await getCommitments());
    } catch {
      setError(translateNow('hook.couldNotLoadYourCommitments'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Executa uma escrita, recarrega a lista (listas pequenas: mais simples
  // e sempre consistente com o servidor) e avisa. Devolve se correu bem.
  const mutate = useCallback(
    async (action: () => Promise<unknown>, failureMessage: string, silent = false): Promise<boolean> => {
      try {
        setIsSaving(true);
        setError('');
        await action();
        await refetch();
        onChanged();
        if (!silent) notify(translateNow('quickWins.scheduleSaved'), 'success');
        return true;
      } catch (caught) {
        const message = getHttpStatus(caught) === HTTP_CONFLICT ? translateNow('hook.youAlreadyHaveOneWithThat') : failureMessage;
        setError(message);
        // Erro por toast (visivel mesmo com o formulario fora do ecra) e no cartao.
        notify(message, 'error');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch, onChanged, notify],
  );

  return {
    overview,
    isLoading,
    isSaving,
    error,
    copyResult,
    clearCopyResult: () => setCopyResult(null),
    clearError: () => setError(''),
    addCommitment: (input: CommitmentInput) =>
      mutate(() => createCommitment(input), translateNow('hook.couldNotCreateIt')),
    editCommitment: (id: string, changes: Partial<CommitmentInput>) =>
      mutate(() => updateCommitment(id, changes), translateNow('hook.couldNotSaveTheChanges')),
    removeCommitment: (id: string) =>
      mutate(() => deleteCommitment(id), translateNow('hook.couldNotDeleteIt')),
    addShifts: (shifts: CreateWorkShiftInput[]) =>
      mutate(() => createWorkShifts(shifts), translateNow('hook.couldNotSaveTheShiftCheck')),
    editShift: (id: string, changes: UpdateWorkShiftInput) =>
      mutate(() => updateWorkShift(id, changes), translateNow('hook.couldNotSaveTheShiftCheck')),
    copyWeek: (input: CopyWeekInput) =>
      mutate(
        async () => setCopyResult(await copyWeekShifts(input)),
        translateNow('hook.couldNotCopyTheWeekCheck'),
      ),
    removeShift: async (id: string) => {
      const shift = [...overview.commitments.flatMap((c) => c.shifts), ...overview.ungroupedShifts].find((x) => x.id === id);
      const done = await mutate(() => deleteWorkShift(id), translateNow('hook.couldNotDeleteTheShift'), !!shift);
      if (done && shift) {
        offerUndoDelete({
          message: translateNow('undoDelete.shift'),
          restore: () => createWorkShifts([shiftToInput(shift)]),
          onRestored: () => {
            void refetch();
            onChanged();
          },
        });
      }
      return done;
    },
  };
}
