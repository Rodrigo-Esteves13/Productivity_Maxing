import api from './client';
import type { AdminBlockedPadSource, AdminPadRow, PadView } from '../types/models';

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

// Itens por pagina das listagens de moderacao (pads.constants.ts).
export const ADMIN_PADS_PAGE_SIZE = 20;

export interface AdminPageQuery {
  skip: number;
  take: number;
}

// Moderacao (admin): todos os pads (pesquisa por nome) e apagar um pad.
export const getAdminPads = async (
  query: AdminPageQuery & { q?: string },
  signal?: AbortSignal,
): Promise<{ total: number; items: AdminPadRow[] }> =>
  (await api.get<{ total: number; items: AdminPadRow[] }>('/pads/admin/recent', { params: query, signal })).data;

// Todas as origens bloqueadas.
export const getBlockedPadSources = async (
  query: AdminPageQuery,
  signal?: AbortSignal,
): Promise<{ total: number; items: AdminBlockedPadSource[] }> =>
  (
    await api.get<{ total: number; items: AdminBlockedPadSource[] }>('/pads/admin/blocked-sources', {
      params: query,
      signal,
    })
  ).data;

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
