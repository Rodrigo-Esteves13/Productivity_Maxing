import api from './client';
import type { PersonalNote } from '../types/models';
import { appendThought, FOCUS_NOTE_TITLES } from '../lib/focusThoughts';

export interface PersonalNoteInput {
  title?: string;
  body?: string;
  pinned?: boolean;
  // ISO com hora; null limpa o lembrete.
  remindAt?: string | null;
  done?: boolean;
}

// Uma nota so, da lista (nao ha rota GET /notes/:id).
const getPersonalNote = async (id: string): Promise<PersonalNote | undefined> =>
  (await getPersonalNotes()).find((n) => n.id === id);

export const getPersonalNotes = async (): Promise<PersonalNote[]> => (await api.get<PersonalNote[]>('/notes')).data;

export const createPersonalNote = async (input: PersonalNoteInput & { title: string }): Promise<PersonalNote> =>
  (await api.post<PersonalNote>('/notes', input)).data;

export const updatePersonalNote = async (id: string, input: PersonalNoteInput): Promise<PersonalNote> =>
  (await api.patch<PersonalNote>(`/notes/${encodeURIComponent(id)}`, input)).data;

export const deletePersonalNote = async (id: string): Promise<void> => {
  await api.delete(`/notes/${encodeURIComponent(id)}`);
};

// Nota onde caem os pensamentos do foco: o id fica em memoria depois da
// primeira vez (nao volta a listar as notas todas) e as gravacoes correm uma
// de cada vez, mesmo vindas de varias instancias do botao, para nao se
// perderem nem criarem duas notas.
let focusNoteId: string | null = null;
let focusQueue: Promise<unknown> = Promise.resolve();

async function findFocusNote(): Promise<PersonalNote | undefined> {
  return (await getPersonalNotes()).find((n) => FOCUS_NOTE_TITLES.includes(n.title));
}

async function appendOnce(title: string, thought: string, stamp: string): Promise<number> {
  const existing = focusNoteId ? await getPersonalNote(focusNoteId) : await findFocusNote();
  if (existing) {
    focusNoteId = existing.id;
    const { body, dropped } = appendThought(existing.body, thought, stamp);
    await updatePersonalNote(existing.id, { body });
    return dropped;
  }
  const { body, dropped } = appendThought('', thought, stamp);
  focusNoteId = (await createPersonalNote({ title, body })).id;
  return dropped;
}

// Acrescenta um pensamento a nota do foco (cria-a se ainda nao existe).
// Devolve quantas linhas antigas foram descartadas para caber.
export const appendFocusThought = (title: string, thought: string, stamp: string): Promise<number> => {
  const run = focusQueue.then(async () => {
    try {
      return await appendOnce(title, thought, stamp);
    } catch (error) {
      // O id guardado pode ja nao existir (nota apagada): tenta uma vez do zero.
      if (!focusNoteId) throw error;
      focusNoteId = null;
      return appendOnce(title, thought, stamp);
    }
  });
  focusQueue = run.catch(() => undefined);
  return run;
};
