import { useCallback, useState } from 'react';
import {
  createTurma,
  getAnnouncements,
  getLinkedAreas,
  getTurmaPacks,
  getMyTurmas,
  getTurmaInvites,
  getTurma,
  getTurmaFiles,
  getTurmaNote,
  getTurmaNotes,
  joinTurma,
  saveTurmaNote,
} from '../api/turmasService';
import type { TurmaNote } from '../types/models';
import { getApiMessage } from '../lib/httpError';
import { useLoadOnce } from './useLoadOnce';
import { useVersionedDoc, type VersionedSnapshot } from './useVersionedDoc';

// Lista das minhas turmas.
export const useMyTurmas = () => useLoadOnce(getMyTurmas);
export const useTurmaInvites = () => useLoadOnce(getTurmaInvites);

// Acao com estado de "a correr" e mensagem de erro do backend. Usado pelos
// formularios e botoes da Turma.
export function useTurmaAction<A extends unknown[], R>(run: (...args: A) => Promise<R>, fallbackError: string) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  const execute = useCallback(
    async (...args: A): Promise<R | null> => {
      setIsBusy(true);
      setError('');
      try {
        return await run(...args);
      } catch (err) {
        setError(getApiMessage(err, fallbackError));
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [run, fallbackError],
  );

  return { execute, isBusy, error, clearError: () => setError('') };
}

export const useCreateTurma = (fallbackError: string) => useTurmaAction(createTurma, fallbackError);
export const useJoinTurma = (fallbackError: string) => useTurmaAction(joinTurma, fallbackError);

export function useTurmaDetail(turmaId: string) {
  const fetcher = useCallback(() => getTurma(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export function useTurmaAnnouncements(turmaId: string) {
  const fetcher = useCallback(() => getAnnouncements(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export function useTurmaNotes(turmaId: string) {
  const fetcher = useCallback(() => getTurmaNotes(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export function useTurmaFiles(turmaId: string) {
  const fetcher = useCallback(() => getTurmaFiles(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export function useTurmaPacks(turmaId: string) {
  const fetcher = useCallback(() => getTurmaPacks(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export function useTurmaLinkedAreas(turmaId: string) {
  const fetcher = useCallback(() => getLinkedAreas(turmaId), [turmaId]);
  return useLoadOnce(fetcher);
}

export interface TurmaNoteDraft {
  title: string;
  content: string;
}

const toSnapshot = (note: TurmaNote): VersionedSnapshot<TurmaNoteDraft> => ({
  doc: { title: note.title, content: note.content },
  version: note.version,
});

function parseNoteConflict(body: unknown): VersionedSnapshot<TurmaNoteDraft> | null {
  const current = (body as { current?: TurmaNote } | null)?.current;
  return current && typeof current.content === 'string' ? toSnapshot(current) : null;
}

// Nota da turma aberta: titulo e texto com gravacao automatica e versoes.
// untitledTitle: o backend exige titulo; um titulo apagado grava este.
// onForbidden: o delegado tirou a permissao de editar notas (recarregar a turma).
export function useTurmaNote(turmaId: string, noteId: string, untitledTitle: string, onForbidden?: () => void) {
  const load = useCallback(async () => toSnapshot(await getTurmaNote(turmaId, noteId)), [turmaId, noteId]);
  const save = useCallback(
    async (draft: TurmaNoteDraft, baseVersion: number) =>
      toSnapshot(
        await saveTurmaNote(turmaId, noteId, {
          title: draft.title.trim() || untitledTitle,
          content: draft.content,
          baseVersion,
        }),
      ),
    [turmaId, noteId, untitledTitle],
  );
  return useVersionedDoc<TurmaNoteDraft>({
    key: `${turmaId}:${noteId}`,
    load,
    save,
    parseConflict: parseNoteConflict,
    onForbidden,
  });
}
