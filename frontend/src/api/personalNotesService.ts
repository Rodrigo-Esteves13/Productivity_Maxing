import api from './client';
import type { PersonalNote } from '../types/models';

export interface PersonalNoteInput {
  title?: string;
  body?: string;
  pinned?: boolean;
  // ISO com hora; null limpa o lembrete.
  remindAt?: string | null;
  done?: boolean;
}

export const getPersonalNotes = async (): Promise<PersonalNote[]> => (await api.get<PersonalNote[]>('/notes')).data;

export const createPersonalNote = async (input: PersonalNoteInput & { title: string }): Promise<PersonalNote> =>
  (await api.post<PersonalNote>('/notes', input)).data;

export const updatePersonalNote = async (id: string, input: PersonalNoteInput): Promise<PersonalNote> =>
  (await api.patch<PersonalNote>(`/notes/${encodeURIComponent(id)}`, input)).data;

export const deletePersonalNote = async (id: string): Promise<void> => {
  await api.delete(`/notes/${encodeURIComponent(id)}`);
};
