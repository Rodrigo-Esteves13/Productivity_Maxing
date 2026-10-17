import api from './client';
import type { SharedEntryResult } from '../types/models';

export interface OwnerAreaOption {
  areaId: string;
  name: string;
  colorHex: string | null;
  entryCount: number;
}

export interface IncomingGrant {
  grantId: string;
  viewerId: string;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  status: 'PENDING' | 'APPROVED';
  areaIds: string[];
  createdAt: string;
}

export interface IncomingGrantsView {
  areas: OwnerAreaOption[];
  grants: IncomingGrant[];
}

export interface OutgoingGrant {
  grantId: string;
  ownerId: string;
  ownerName: string | null;
  status: 'PENDING' | 'APPROVED';
  areaCount: number;
}

export interface FriendNoteListItem {
  id: string;
  title: string;
  entryType: string;
  classNumber: number | null;
  date: string;
  areaId: string;
  areaName: string;
  areaColor: string | null;
}

export interface FriendNotesList {
  ownerName: string | null;
  entries: FriendNoteListItem[];
}

export const requestNotesAccess = async (ownerId: string): Promise<'PENDING' | 'APPROVED'> =>
  (await api.post<{ status: 'PENDING' | 'APPROVED' }>('/social/notes/requests', { ownerId })).data.status;

export const getIncomingGrants = async (): Promise<IncomingGrantsView> =>
  (await api.get<IncomingGrantsView>('/social/notes/incoming')).data;

export const getOutgoingGrants = async (): Promise<OutgoingGrant[]> =>
  (await api.get<OutgoingGrant[]>('/social/notes/outgoing')).data;

export const decideGrant = async (grantId: string, approve: boolean, areaIds?: string[]): Promise<void> => {
  await api.post(`/social/notes/grants/${grantId}/decide`, { approve, areaIds });
};

export const updateGrantAreas = async (grantId: string, areaIds: string[]): Promise<void> => {
  await api.patch(`/social/notes/grants/${grantId}/areas`, { areaIds });
};

export const removeGrant = async (grantId: string): Promise<void> => {
  await api.delete(`/social/notes/grants/${grantId}`);
};

export const getFriendNotes = async (ownerId: string): Promise<FriendNotesList> =>
  (await api.get<FriendNotesList>(`/social/notes/from/${ownerId}`)).data;

export const getFriendNoteEntry = async (ownerId: string, entryId: string): Promise<SharedEntryResult> =>
  (await api.get<SharedEntryResult>(`/social/notes/from/${ownerId}/entries/${entryId}`)).data;
