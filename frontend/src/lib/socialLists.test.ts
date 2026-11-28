import { describe, expect, it } from 'vitest';
import type { FriendEntry } from '../api/socialService';
import type { FriendNoteListItem } from '../api/socialNotesService';
import { ALL_AREAS, filterNotesByArea, noteAreas, sortFriendNotes, sortFriends } from './socialLists';

const friend = (name: string | null, since: string): FriendEntry => ({
  friendshipId: name ?? 'x', userId: name ?? 'x', name, avatarUrl: null, since,
});
const note = (id: string, title: string, date: string, areaId: string, areaName: string): FriendNoteListItem => ({
  id, title, entryType: 'NOTE', classNumber: null, date, areaId, areaName, areaColor: null,
});

describe('sortFriends', () => {
  const list = [friend('Zé', '2024-01-01'), friend('ana', '2025-01-01'), friend(null, '2023-01-01')];
  it('por nome, sem nome primeiro', () => {
    expect(sortFriends(list, 'name').map((f) => f.name)).toEqual([null, 'ana', 'Zé']);
  });
  it('por mais recente', () => {
    expect(sortFriends(list, 'recent').map((f) => f.name)).toEqual(['ana', 'Zé', null]);
  });
  it('nao muda o original', () => {
    sortFriends(list, 'name');
    expect(list[0].name).toBe('Zé');
  });
});

describe('notas de amigo', () => {
  const entries = [
    note('1', 'b', '2024-01-01', 'a1', 'Fisica'),
    note('2', 'A', '2025-01-01', 'a2', 'Algebra'),
    note('3', 'c', '2023-01-01', 'a1', 'Fisica'),
  ];
  it('ordena', () => {
    expect(sortFriendNotes(entries, 'newest').map((e) => e.id)).toEqual(['2', '1', '3']);
    expect(sortFriendNotes(entries, 'oldest').map((e) => e.id)).toEqual(['3', '1', '2']);
    expect(sortFriendNotes(entries, 'title').map((e) => e.id)).toEqual(['2', '1', '3']);
  });
  it('filtra por cadeira', () => {
    expect(filterNotesByArea(entries, ALL_AREAS)).toHaveLength(3);
    expect(filterNotesByArea(entries, 'a1').map((e) => e.id)).toEqual(['1', '3']);
  });
  it('lista cadeiras distintas', () => {
    expect(noteAreas(entries)).toEqual([
      { areaId: 'a2', areaName: 'Algebra' },
      { areaId: 'a1', areaName: 'Fisica' },
    ]);
  });
});
