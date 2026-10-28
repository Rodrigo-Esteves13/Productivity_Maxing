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
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPersonalNotes()
      .then((rows) => setNotes(sortNotes(rows)))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      try {
        await action();
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
      }),
    [run],
  );

  const update = useCallback(
    (id: string, input: PersonalNoteInput) =>
      run(async () => {
        const note = await updatePersonalNote(id, input);
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? note : n))));
      }),
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await deletePersonalNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }),
    [run],
  );

  return { notes, isLoading, error, create, update, remove };
}
