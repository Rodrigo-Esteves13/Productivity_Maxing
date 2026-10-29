import api from './client';
import type {
  TurmaAnnouncement,
  TurmaDetail,
  TurmaFile,
  TurmaInvite,
  TurmaLinkedArea,
  TurmaLinkedEntry,
  TurmaLinkedEntrySummary,
  TurmaNote,
  TurmaNoteSearchResult,
  TurmaNoteSummary,
  TurmaPack,
  TurmaSummary,
} from '../types/models';

const base = (turmaId: string) => `/classes/${encodeURIComponent(turmaId)}`;

export const getMyTurmas = async (): Promise<TurmaSummary[]> => (await api.get<TurmaSummary[]>('/classes')).data;

export const createTurma = async (input: { name: string; description?: string }): Promise<{ id: string }> =>
  (await api.post<{ id: string }>('/classes', input)).data;

export const joinTurma = async (code: string): Promise<{ id: string }> =>
  (await api.post<{ id: string }>('/classes/join', { code })).data;

// Convites diretos (um amigo; um admin pode usar o email de qualquer conta).
export const inviteToTurma = async (turmaId: string, input: { userId?: string; email?: string }): Promise<void> => {
  await api.post(`${base(turmaId)}/invites`, input);
};

export const getTurmaInvites = async (): Promise<TurmaInvite[]> =>
  (await api.get<TurmaInvite[]>('/classes/invites')).data;

export const acceptTurmaInvite = async (inviteId: string): Promise<{ id: string }> =>
  (await api.post<{ id: string }>(`/classes/invites/${encodeURIComponent(inviteId)}/accept`)).data;

export const declineTurmaInvite = async (inviteId: string): Promise<void> => {
  await api.delete(`/classes/invites/${encodeURIComponent(inviteId)}`);
};

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

export const getTurmaPacks = async (turmaId: string): Promise<TurmaPack[]> =>
  (await api.get<TurmaPack[]>(`${base(turmaId)}/packs`)).data;

export const shareTurmaPack = async (turmaId: string, packId: string): Promise<void> => {
  await api.post(`${base(turmaId)}/packs`, { packId });
};

export const unshareTurmaPack = async (turmaId: string, linkId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/packs/${encodeURIComponent(linkId)}`);
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

// Horario partilhado da turma (cada membro escolhe partilhar o seu).
export interface TurmaScheduleClass {
  subject: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  location: string | null;
  sharedBy: number;
  inMine: boolean;
}

export interface TurmaSchedule {
  sharing: boolean;
  sharers: number;
  classes: TurmaScheduleClass[];
}

export const getTurmaSchedule = async (turmaId: string): Promise<TurmaSchedule> =>
  (await api.get<TurmaSchedule>(`/classes/${encodeURIComponent(turmaId)}/schedule`)).data;

export const setTurmaScheduleSharing = async (turmaId: string, share: boolean): Promise<void> => {
  await api.patch(`/classes/${encodeURIComponent(turmaId)}/schedule/sharing`, { share });
};

export const copyTurmaSubject = async (turmaId: string, subject: string): Promise<{ copied: number }> =>
  (await api.post<{ copied: number }>(`/classes/${encodeURIComponent(turmaId)}/schedule/copy`, { subject })).data;

// Licenciatura partilhada: copia da estrutura do Grades (sem notas).
export interface TurmaProgramPeriod {
  name: string;
  startDate: string;
  endDate: string | null;
  courses: { name: string; credits: number | null; components: { name: string; weightPercentage: number }[] }[];
}

export interface TurmaProgram {
  id: string;
  name: string;
  sharedById: string;
  sharedByName: string | null;
  createdAt: string;
  snapshot: { gradeScale: string; periods: TurmaProgramPeriod[] };
}

export const getTurmaPrograms = async (turmaId: string): Promise<TurmaProgram[]> =>
  (await api.get<TurmaProgram[]>(`/classes/${encodeURIComponent(turmaId)}/programs`)).data;

export const shareTurmaProgram = async (turmaId: string, programId: string): Promise<void> => {
  await api.post(`/classes/${encodeURIComponent(turmaId)}/programs`, { programId });
};

export const removeTurmaProgram = async (turmaId: string, linkId: string): Promise<void> => {
  await api.delete(`/classes/${encodeURIComponent(turmaId)}/programs/${encodeURIComponent(linkId)}`);
};

export const importTurmaProgram = async (
  turmaId: string,
  linkId: string,
): Promise<{ programId: string; periods: number; courses: number }> =>
  (await api.post(`/classes/${encodeURIComponent(turmaId)}/programs/${encodeURIComponent(linkId)}/import`)).data;

export type TurmaDeadlineKind = 'FREQUENCIA' | 'TRABALHO_PRATICO';

export interface TurmaDeadline {
  id: string;
  title: string;
  subject: string;
  dueAt: string;
  weightPercentage: number | null;
  kind: TurmaDeadlineKind;
  createdById: string | null;
  createdByName: string | null;
  myTaskId: string | null;
  addedCount: number;
}

export interface TurmaDeadlineInput {
  title: string;
  subject: string;
  dueAt: string;
  weightPercentage: number | null;
  kind: TurmaDeadlineKind;
}

export const getTurmaDeadlines = async (turmaId: string): Promise<TurmaDeadline[]> =>
  (await api.get<TurmaDeadline[]>(`${base(turmaId)}/deadlines`)).data;

export const createTurmaDeadline = async (turmaId: string, input: TurmaDeadlineInput): Promise<void> => {
  await api.post(`${base(turmaId)}/deadlines`, input);
};

export const updateTurmaDeadline = async (
  turmaId: string,
  deadlineId: string,
  input: Partial<TurmaDeadlineInput>,
): Promise<void> => {
  await api.patch(`${base(turmaId)}/deadlines/${encodeURIComponent(deadlineId)}`, input);
};

export const removeTurmaDeadline = async (turmaId: string, deadlineId: string): Promise<void> => {
  await api.delete(`${base(turmaId)}/deadlines/${encodeURIComponent(deadlineId)}`);
};

export const adoptTurmaDeadline = async (
  turmaId: string,
  deadlineId: string,
  areaId: string,
): Promise<{ taskId: string }> =>
  (await api.post<{ taskId: string }>(`${base(turmaId)}/deadlines/${encodeURIComponent(deadlineId)}/adopt`, { areaId }))
    .data;
