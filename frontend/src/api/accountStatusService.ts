// src/api/accountStatusService.ts
import api from './client';
import type { AccountStatusInfo, AppealAdmin, AppealResolution, PaginatedAppeals } from '../types/models';

// ACCOUNT STATUS / APPEALS (AccountBlockedPage)
// bearerToken só vem preenchido no caso "bloqueado logo no login" - aí
// não existe cookie de sessão nenhum (o login em si falhou), o appealToken
// devolvido nesse erro (ver AuthService.accountBlockedResponse) é enviado
// via header em vez disso. No caso "bloqueado a meio de uma sessão", vem
// undefined e o cookie normal (withCredentials, já default em `api`)
// resolve sozinho - ver JwtBlockedAwareStrategy no backend.
const bearerConfig = (bearerToken?: string) =>
  bearerToken ? { headers: { Authorization: `Bearer ${bearerToken}` } } : undefined;

export const getMyAccountStatus = async (bearerToken?: string): Promise<AccountStatusInfo> => {
  const response = await api.get<AccountStatusInfo>(
    '/account-status/me',
    bearerConfig(bearerToken),
  );
  return response.data;
};

export const submitAppeal = async (
  message: string,
  bearerToken?: string,
): Promise<{ id: string; createdAt: string }> => {
  const response = await api.post<{ id: string; createdAt: string }>(
    '/appeals',
    { message },
    bearerConfig(bearerToken),
  );
  return response.data;
};

// Admin only (Appeals page) - status defaults a 'pending' no backend.
export interface GetAppealsQuery {
  status?: 'pending' | 'all';
  skip?: number;
  take?: number;
}

export const getAppeals = async (query: GetAppealsQuery = {}): Promise<PaginatedAppeals> => {
  const response = await api.get<PaginatedAppeals>('/appeals', { params: query });
  return response.data;
};

export const resolveAppeal = async (
  id: string,
  resolution: AppealResolution,
  resolutionNote?: string,
): Promise<AppealAdmin> => {
  const response = await api.patch<AppealAdmin>(`/appeals/${id}/resolve`, {
    resolution,
    resolutionNote,
  });
  return response.data;
};
