import { useCallback, useEffect, useState } from 'react';
import {
  createPersonalNote,
  deletePersonalNote,
  getPersonalNotes,
  updatePersonalNote,
  type PersonalNoteInput,
} from '../api/personalNotesService';
import type { PersonalNote } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { useUndoableDelete } from './useUndoableDelete';

// Mesma ordem do backend: por fazer primeiro, depois afixadas, depois as
// mais recentes. Reaplicada localmente depois de cada alteracao.
export function sortNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort(
    (a, b) =>
      Number(a.doneAt !== null) - Number(b.doneAt !== null) ||
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

// Notas pessoais: lista e acoes. Erros viram um toast; as acoes devolvem
// true quando correram bem (para o formulario fechar).
export function usePersonalNotes() {
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNotes = useCallback(() => {
    getPersonalNotes()
      .then((rows) => setNotes(sortNotes(rows)))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // "Tentar de novo" do estado de erro.
  const reload = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetchNotes();
  }, [fetchNotes]);

  const run = useCallback(
    async (action: () => Promise<void>, successKey: string): Promise<boolean> => {
      try {
        await action();
        notify(translateNow(successKey), 'success');
        return true;
      } catch {
        notify(translateNow('notes.saveError'), 'error');
        return false;
      }
    },
    [notify],
  );

  const create = useCallback(
    (input: PersonalNoteInput & { title: string }) =>
      run(async () => {
        const note = await createPersonalNote(input);
        setNotes((prev) => sortNotes([note, ...prev]));
      }, 'quickWins.noteCreated'),
    [run],
  );

  const update = useCallback(
    (id: string, input: PersonalNoteInput) =>
      run(async () => {
        const note = await updatePersonalNote(id, input);
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? note : n))));
      }, 'quickWins.noteSaved'),
    [run],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const note = notes.find((n) => n.id === id);
      try {
        await deletePersonalNote(id);
      } catch {
        notify(translateNow('notes.saveError'), 'error');
        return false;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (!note) {
        notify(translateNow('quickWins.noteDeleted'), 'success');
        return true;
      }
      offerUndoDelete({
        message: translateNow('undoDelete.note'),
        restore: () =>
          createPersonalNote({
            title: note.title,
            body: note.body,
            pinned: note.pinned,
            // Um lembrete ja passado seria recusado; so volta se ainda for futuro.
            remindAt: note.remindAt && new Date(note.remindAt).getTime() > Date.now() ? note.remindAt : undefined,
            done: note.doneAt !== null ? true : undefined,
          }),
        onRestored: (restored) => setNotes((prev) => sortNotes([restored, ...prev])),
      });
      return true;
    },
    [notes, notify, offerUndoDelete],
  );

  return { notes, isLoading, error, reload, create, update, remove };
}
