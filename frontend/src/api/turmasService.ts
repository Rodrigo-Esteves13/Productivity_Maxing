import api from './client';
import type {
  TurmaAnnouncement,
  TurmaDetail,
  TurmaFile,
  TurmaLinkedArea,
  TurmaLinkedEntry,
  TurmaLinkedEntrySummary,
  TurmaNote,
  TurmaNoteSearchResult,
  TurmaNoteSummary,
  TurmaSummary,
} from '../types/models';

const base = (turmaId: string) => `/classes/${encodeURIComponent(turmaId)}`;

export const getMyTurmas = async (): Promise<TurmaSummary[]> => (await api.get<TurmaSummary[]>('/classes')).data;

export const createTurma = async (input: { name: string; description?: string }): Promise<{ id: string }> =>
  (await api.post<{ id: string }>('/classes', input)).data;

export const joinTurma = async (code: string): Promise<{ id: string }> =>
  (await api.post<{ id: string }>('/classes/join', { code })).data;

export const getTurma = async (turmaId: string): Promise<TurmaDetail> =>
  (await api.get<TurmaDetail>(base(turmaId))).data;

export const updateTurma = async (
  turmaId: string,
  input: { name?: string; description?: string; membersCanEditNotes?: boolean },
): Promise<TurmaDetail> => (await api.patch<TurmaDetail>(base(turmaId), input)).data;

export const deleteTurma = async (turmaId: string): Promise<void> => {
  await api.delete(base(turmaId));
};

export const regenerateInviteCode = async (turmaId: string): Promise<{ inviteCode: string }> =>
  (await api.post<{ inviteCode: string }>(`${base(turmaId)}/invite-code`)).data;

export const leaveTurma = async (turmaId: string): Promise<{ left: boolean; deleted: boolean }> =>
  (await api.post<{ left: boolean; deleted: boolean }>(`${base(turmaId)}/leave`)).data;

export const removeTurmaMember = async (turmaId: string, userId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/members/${encodeURIComponent(userId)}`);
};

export const transferDelegado = async (turmaId: string, userId: string): Promise<TurmaDetail> =>
  (await api.put<TurmaDetail>(`${base(turmaId)}/representative`, { userId })).data;

export const getAnnouncements = async (turmaId: string): Promise<TurmaAnnouncement[]> =>
  (await api.get<TurmaAnnouncement[]>(`${base(turmaId)}/announcements`)).data;

export const createAnnouncement = async (turmaId: string, input: { title: string; body: string }): Promise<void> => {
  await api.post(`${base(turmaId)}/announcements`, input);
};

export const deleteAnnouncement = async (turmaId: string, announcementId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/announcements/${encodeURIComponent(announcementId)}`);
};

export const getTurmaNotes = async (turmaId: string): Promise<TurmaNoteSummary[]> =>
  (await api.get<TurmaNoteSummary[]>(`${base(turmaId)}/notes`)).data;

export const createTurmaNote = async (turmaId: string, title: string): Promise<TurmaNote> =>
  (await api.post<TurmaNote>(`${base(turmaId)}/notes`, { title })).data;

export const getTurmaNote = async (turmaId: string, noteId: string): Promise<TurmaNote> =>
  (await api.get<TurmaNote>(`${base(turmaId)}/notes/${encodeURIComponent(noteId)}`)).data;

// 409 quando alguem gravou depois de baseVersion: o corpo traz `current`.
export const saveTurmaNote = async (
  turmaId: string,
  noteId: string,
  input: { title: string; content: string; baseVersion: number },
): Promise<TurmaNote> => (await api.put<TurmaNote>(`${base(turmaId)}/notes/${encodeURIComponent(noteId)}`, input)).data;

export const deleteTurmaNote = async (turmaId: string, noteId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/notes/${encodeURIComponent(noteId)}`);
};

export const getTurmaFiles = async (turmaId: string): Promise<TurmaFile[]> =>
  (await api.get<TurmaFile[]>(`${base(turmaId)}/files`)).data;

export const uploadTurmaFile = async (turmaId: string, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('file', file);
  await api.post(`${base(turmaId)}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const deleteTurmaFile = async (turmaId: string, fileId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/files/${encodeURIComponent(fileId)}`);
};

export const getLinkedAreas = async (turmaId: string): Promise<TurmaLinkedArea[]> =>
  (await api.get<TurmaLinkedArea[]>(`${base(turmaId)}/linked-areas`)).data;

export const linkArea = async (turmaId: string, areaId: string): Promise<void> => {
  await api.post(`${base(turmaId)}/linked-areas`, { areaId });
};

export const unlinkArea = async (turmaId: string, linkId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/linked-areas/${encodeURIComponent(linkId)}`);
};

export const getLinkedEntries = async (turmaId: string, linkId: string): Promise<TurmaLinkedEntrySummary[]> =>
  (await api.get<TurmaLinkedEntrySummary[]>(`${base(turmaId)}/linked-areas/${encodeURIComponent(linkId)}/entries`))
    .data;

export const getLinkedEntry = async (turmaId: string, linkId: string, entryId: string): Promise<TurmaLinkedEntry> =>
  (
    await api.get<TurmaLinkedEntry>(
      `${base(turmaId)}/linked-areas/${encodeURIComponent(linkId)}/entries/${encodeURIComponent(entryId)}`,
    )
  ).data;

// Pesquisa global (Ctrl+K) nas notas das turmas de que sou membro.
export const searchTurmaNotes = async (q: string): Promise<TurmaNoteSearchResult[]> =>
  (await api.get<TurmaNoteSearchResult[]>('/classes/search', { params: { q } })).data;
