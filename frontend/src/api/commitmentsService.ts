// src/api/commitmentsService.ts
import api from './client';
import type { Commitment, CommitmentsOverview } from '../types/models';

export const getCommitments = async (): Promise<CommitmentsOverview> => {
  const response = await api.get<CommitmentsOverview>('/commitments');
  return response.data;
};

export const createCommitment = async (input: {
  name: string;
  commuteMinutes: number;
}): Promise<Commitment> => {
  const response = await api.post<Commitment>('/commitments', input);
  return response.data;
};

export const updateCommitment = async (
  id: string,
  changes: { name?: string; commuteMinutes?: number },
): Promise<Commitment> => {
  const response = await api.patch<Commitment>(`/commitments/${id}`, changes);
  return response.data;
};

export const deleteCommitment = async (id: string): Promise<void> => {
  await api.delete(`/commitments/${id}`);
};
