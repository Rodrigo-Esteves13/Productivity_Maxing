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
} from '../types/models';
import { getHttpStatus, HTTP_CONFLICT } from '../lib/httpError';
import { translateNow } from '../i18n/translate';

const EMPTY: CommitmentsOverview = { commitments: [], ungroupedShifts: [] };

// Qualquer alteração a locais/turnos muda o plano de estudo, a grelha e o
// que o Google Calendar devia ter: `onChanged` avisa quem precisa de refazer.
export function useCommitments(onChanged: () => void) {
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
    async (action: () => Promise<unknown>, failureMessage: string): Promise<boolean> => {
      try {
        setIsSaving(true);
        setError('');
        await action();
        await refetch();
        onChanged();
        return true;
      } catch (caught) {
        setError(getHttpStatus(caught) === HTTP_CONFLICT ? translateNow('hook.youAlreadyHaveOneWithThat') : failureMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch, onChanged],
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
    removeShift: (id: string) =>
      mutate(() => deleteWorkShift(id), translateNow('hook.couldNotDeleteTheShift')),
  };
}
