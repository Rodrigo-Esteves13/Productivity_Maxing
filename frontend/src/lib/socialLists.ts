import type { FriendEntry } from '../api/socialService';
import type { FriendNoteListItem } from '../api/socialNotesService';

// Ordenacao e filtro (logica pura) das listas do Social.

export type FriendSort = 'name' | 'recent';
export type FriendNoteSort = 'newest' | 'oldest' | 'title';

export const ALL_AREAS = 'all';

const compareText = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base' });
const timeOf = (iso: string): number => new Date(iso).getTime();

const FRIEND_COMPARATORS: Record<FriendSort, (a: FriendEntry, b: FriendEntry) => number> = {
  name: (a, b) => compareText(a.name ?? '', b.name ?? ''),
  recent: (a, b) => timeOf(b.since) - timeOf(a.since),
};

export function sortFriends(friends: readonly FriendEntry[], sort: FriendSort): FriendEntry[] {
  return [...friends].sort(FRIEND_COMPARATORS[sort]);
}

const NOTE_COMPARATORS: Record<FriendNoteSort, (a: FriendNoteListItem, b: FriendNoteListItem) => number> = {
  newest: (a, b) => timeOf(b.date) - timeOf(a.date),
  oldest: (a, b) => timeOf(a.date) - timeOf(b.date),
  title: (a, b) => compareText(a.title, b.title),
};

export function sortFriendNotes(entries: readonly FriendNoteListItem[], sort: FriendNoteSort): FriendNoteListItem[] {
  return [...entries].sort(NOTE_COMPARATORS[sort]);
}

export function filterNotesByArea(entries: readonly FriendNoteListItem[], areaId: string): FriendNoteListItem[] {
  return areaId === ALL_AREAS ? entries.slice() : entries.filter((e) => e.areaId === areaId);
}

/** Cadeiras distintas que aparecem nas notas, por ordem alfabetica. */
export function noteAreas(entries: readonly FriendNoteListItem[]): { areaId: string; areaName: string }[] {
  const seen = new Map<string, string>();
  for (const e of entries) if (!seen.has(e.areaId)) seen.set(e.areaId, e.areaName);
  return [...seen].map(([areaId, areaName]) => ({ areaId, areaName })).sort((a, b) => compareText(a.areaName, b.areaName));
}
