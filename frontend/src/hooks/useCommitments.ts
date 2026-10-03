import { useCallback, useEffect, useState } from 'react';
import {
  createCommitment,
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
      setError('Could not load your commitments.');
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
        setError(getHttpStatus(caught) === HTTP_CONFLICT ? 'You already have one with that name.' : failureMessage);
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
    addCommitment: (name: string, commuteMinutes: number) =>
      mutate(() => createCommitment({ name, commuteMinutes }), 'Could not create it.'),
    editCommitment: (id: string, changes: { name?: string; commuteMinutes?: number }) =>
      mutate(() => updateCommitment(id, changes), 'Could not save the changes.'),
    removeCommitment: (id: string) =>
      mutate(() => deleteCommitment(id), 'Could not delete it.'),
    addShifts: (shifts: CreateWorkShiftInput[]) =>
      mutate(() => createWorkShifts(shifts), 'Could not save the shift. Check the times.'),
    editShift: (id: string, changes: UpdateWorkShiftInput) =>
      mutate(() => updateWorkShift(id, changes), 'Could not save the shift. Check the times.'),
    copyWeek: (input: CopyWeekInput) =>
      mutate(
        async () => setCopyResult(await copyWeekShifts(input)),
        'Could not copy the week. Check the weeks you picked.',
      ),
    removeShift: (id: string) =>
      mutate(() => deleteWorkShift(id), 'Could not delete the shift.'),
  };
}
