import api from './client';
import type { AdminPadRow, PadView } from '../types/models';

export const getPad = async (slug: string): Promise<PadView> =>
  (await api.get<PadView>(`/pads/${encodeURIComponent(slug)}`)).data;

// 409 quando alguem gravou depois de baseVersion: o corpo traz `current`.
export const savePad = async (slug: string, content: string, baseVersion: number): Promise<PadView> =>
  (await api.put<PadView>(`/pads/${encodeURIComponent(slug)}`, { content, baseVersion })).data;

// Trancar/destrancar (precisa de conta): todos leem, so quem trancou edita.
export const lockPad = async (slug: string): Promise<PadView> =>
  (await api.post<PadView>(`/pads/${encodeURIComponent(slug)}/lock`)).data;

export const unlockPad = async (slug: string): Promise<PadView> =>
  (await api.delete<PadView>(`/pads/${encodeURIComponent(slug)}/lock`)).data;

// Moderacao (admin): pads alterados mais recentemente e apagar um pad.
export const getRecentPadsForAdmin = async (): Promise<AdminPadRow[]> =>
  (await api.get<AdminPadRow[]>('/pads/admin/recent')).data;

export const deletePadAsAdmin = async (slug: string): Promise<void> => {
  await api.delete(`/pads/${encodeURIComponent(slug)}`);
};

// Impede (ou volta a deixar) uma origem sem conta de gravar pads.
export const blockPadSource = async (ipHash: string): Promise<void> => {
  await api.post('/pads/admin/blocked-sources', { ipHash });
};

export const unblockPadSource = async (ipHash: string): Promise<void> => {
  await api.delete(`/pads/admin/blocked-sources/${encodeURIComponent(ipHash)}`);
};
