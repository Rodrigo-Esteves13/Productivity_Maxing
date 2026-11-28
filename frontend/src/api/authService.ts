// src/api/authService.ts
import api, { refreshSession } from './client';
import type { SecurityActivityExport } from '../utils/securityActivityCsv';
import type { DeviceSession } from '../types/models';

// AUTH ENDPOINTS
// Login/registo já não devolvem o JWT no corpo - o backend define-o num
// cookie HttpOnly diretamente. O que volta aqui é só o csrfToken, que o
// AuthContext guarda em memória (ver api/csrfStore.ts) para o reenviar no
// header X-CSRF-Token dos pedidos seguintes.
export type LoginResult =
  | { csrfToken: string; requiresTwoFactor?: undefined }
  | { requiresTwoFactor: true; twoFactorToken: string; csrfToken?: undefined };

export const loginRequest = async (
  email: string,
  password: string,
): Promise<LoginResult> => {
  const response = await api.post<LoginResult>('/auth/login', {
    email,
    password,
  });
  return response.data;
};

// 2FA (so existe com TWO_FACTOR_ENABLED no backend).
export const twoFactorLoginRequest = async (
  token: string,
  code: string,
): Promise<{ csrfToken: string }> => {
  const response = await api.post<{ csrfToken: string }>('/auth/2fa/login', { token, code });
  return response.data;
};

export const beginTwoFactorSetup = async (): Promise<{ secret: string; otpauthUri: string }> => {
  const response = await api.post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup');
  return response.data;
};

export const confirmTwoFactorSetup = async (code: string): Promise<{ recoveryCodes: string[] }> => {
  const response = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/confirm', { code });
  return response.data;
};

export const disableTwoFactor = async (code: string): Promise<void> => {
  await api.post('/auth/2fa/disable', { code });
};

export const registerRequest = async (data: {
  name?: string;
  email: string;
  password: string;
}): Promise<RegisterResult> => {
  const response = await api.post<RegisterResult>('/auth/register', data);
  return response.data;
};

// Com a verificacao de email LIGADA no backend (REQUIRE_EMAIL_VERIFICATION)
// o registo nao abre sessao: devolve este shape em vez de um csrfToken.
// Email de uma conta que ainda nao tem password (Google/GitHub/Discord): o
// backend manda um link para o dono a juntar a mesma conta, sem sessao.
export type RegisterResult =
  | { csrfToken: string; requiresEmailVerification?: undefined; passwordLinkSent?: undefined }
  | { requiresEmailVerification: true; email: string; csrfToken?: undefined; passwordLinkSent?: undefined }
  | { passwordLinkSent: true; email: string; csrfToken?: undefined; requiresEmailVerification?: undefined };

// Pagina /set-password: escolhe a password da conta do link do email. Nao
// abre sessao, o login a seguir e o normal.
export const completePasswordLinkRequest = async (token: string, password: string): Promise<{ email: string }> => {
  const response = await api.post<{ linked: true; email: string }>('/auth/password-link', { token, password });
  return { email: response.data.email };
};

// Link do email de verificacao (pagina /verify-email).
export const verifyEmailRequest = async (token: string): Promise<{ email: string }> => {
  const response = await api.post<{ verified: true; email: string }>('/auth/verify-email', { token });
  return { email: response.data.email };
};

// Resposta sempre generica (nunca diz se o email tem conta).
export const resendVerificationRequest = async (email: string): Promise<void> => {
  await api.post('/auth/resend-verification', { email });
};

export const logoutRequest = async (): Promise<void> => {
  await api.post('/auth/logout');
};

// Pede ao backend para disparar o email de recuperação de password
// (Supabase). A resposta é sempre a mesma mensagem genérica, quer o email
// exista ou não - não dá para saber se a conta existe a partir disto.
export const forgotPasswordRequest = async (email: string): Promise<void> => {
  await api.post('/auth/forgot-password', { email });
};

// Fim do "esqueci-me da password": o backend valida o token da sessao de
// recovery do Supabase, muda a password e termina todas as sessoes da conta.
export const RESET_LINK_INVALID_CODE = 'RESET_LINK_INVALID';
export const completePasswordResetRequest = async (accessToken: string, password: string): Promise<void> => {
  await api.post('/auth/reset-password', { accessToken, password });
};

// Define ou muda a password da conta autenticada (funciona tanto para
// contas só-OAuth a adicionar a primeira password, como para contas que já
// tinham uma). Se a conta ja tem password, a atual e obrigatoria (o backend
// devolve 400 sem ela e 401 se estiver errada).
export const setPasswordRequest = async (password: string, currentPassword?: string): Promise<void> => {
  await api.patch('/auth/me/password', currentPassword ? { password, currentPassword } : { password });
};

// Chamado depois de um redirect de OAuth (o cookie de sessão já lá está,
// mas o csrfToken não veio no redirect) e também no arranque da app, para
// verificar se ainda existe uma sessão válida e obter um csrf token novo.
// Com o JWT de acesso (15 min) ja expirado, o backend responde
// refreshable: true e a sessao e renovada aqui com o refresh token, sem
// voltar a pedir login.
export const fetchCsrfToken = async (): Promise<string> => {
  const response = await api.get<{ authenticated: boolean; csrfToken?: string; refreshable?: boolean }>(
    '/auth/csrf',
  );
  if (response.data.authenticated && response.data.csrfToken) {
    return response.data.csrfToken;
  }
  if (response.data.refreshable) {
    const refreshed = await refreshSession();
    if (refreshed) return refreshed.csrfToken;
  }
  throw new Error('Not authenticated');
};

// Garante uma sessao com JWT de acesso valido antes de sair da app para um
// fluxo do backend por navegacao (ex: ligar o Google Calendar), onde o
// cliente HTTP nao consegue renovar o token sozinho. Renova SEMPRE (JWT novo
// com os 15 minutos todos): o callback do Google so aceita o "ligar conta"
// com o JWT ainda valido, e um token prestes a expirar (ex: 30 s) morria
// durante o ecra de consentimento. Sem refresh token (sessao antiga), cai
// num pedido autenticado barato, como antes.
export const ensureFreshSession = async (): Promise<void> => {
  if (await refreshSession()) return;
  await api.get('/auth/me');
};

// SESSOES POR DISPOSITIVO (pagina Devices)
export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  const response = await api.get<DeviceSession[]>('/auth/sessions');
  return response.data;
};

export const revokeDeviceSession = async (id: string): Promise<void> => {
  await api.delete(`/auth/sessions/${encodeURIComponent(id)}`);
};

export const revokeOtherDeviceSessions = async (): Promise<void> => {
  await api.post('/auth/sessions/revoke-others');
};

// Export "Download my security activity" (pagina Devices): so a propria
// conta, sem hashes nem tokens. O CSV e montado em utils/securityActivityCsv.
export const getSecurityActivityExport = async (): Promise<SecurityActivityExport> => {
  const response = await api.get<SecurityActivityExport>('/auth/security-activity/export');
  return response.data;
};
