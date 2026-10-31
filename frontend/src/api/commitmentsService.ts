// src/api/commitmentsService.ts
import api from './client';
import type { Commitment, CommitmentsOverview, CommuteMode, ContractType } from '../types/models';

export const getCommitments = async (): Promise<CommitmentsOverview> => {
  const response = await api.get<CommitmentsOverview>('/commitments');
  return response.data;
};

export interface CommitmentInput {
  name: string;
  commuteMinutes: number;
  daysOff?: number[];
  contractType?: ContractType | null;
  /** YYYY-MM-DD do ultimo dia de trabalho. */
  endsOn?: string | null;
  address?: string;
  commuteMode?: CommuteMode;
  // false = sem turnos semanais nos feriados nacionais.
  worksOnHolidays?: boolean;
}

export const createCommitment = async (input: CommitmentInput): Promise<Commitment> => {
  const response = await api.post<Commitment>('/commitments', input);
  return response.data;
};

export const updateCommitment = async (
  id: string,
  changes: Partial<CommitmentInput>,
): Promise<Commitment> => {
  const response = await api.patch<Commitment>(`/commitments/${id}`, changes);
  return response.data;
};

export const deleteCommitment = async (id: string): Promise<void> => {
  await api.delete(`/commitments/${id}`);
};

// Pre-visualizacao casa -> morada (nao grava nada; a origem e a morada de casa
// do perfil, no servidor).
export const estimateCommitmentCommute = async (
  address: string,
  mode: CommuteMode,
): Promise<{ commuteMinutes: number }> => {
  const response = await api.post<{ commuteMinutes: number }>('/commitments/commute/estimate', {
    address,
    mode,
  });
  return response.data;
};
