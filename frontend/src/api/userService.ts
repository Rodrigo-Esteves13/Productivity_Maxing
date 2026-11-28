// src/api/userService.ts
import api from './client';
import type { UsersPageQuery } from '../lib/adminLists';
import type { User, Role, CommuteMode } from '../types/models';

// USER ENDPOINTS
export const getUserProfile = async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
  return response.data;
};

// Atualiza o nome do utilizador autenticado.
export const updateUserProfile = async (data: {
  name?: string;
  // null limpa o valor guardado (undefined = nao mexer).
  commuteMinutes?: number | null;
  commuteMode?: CommuteMode;
  homeAddress?: string | null;
  campusAddress?: string | null;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  deadlineEmailReminders?: boolean;
  deadlinePushReminders?: boolean;
  mutedPushKinds?: string[];
  spacedReviewsEnabled?: boolean;
  notesPrivateByDefault?: boolean;
}): Promise<User> => {
  const response = await api.patch<User>('/auth/me', data);
  return response.data;
};

// Faz upload de uma nova foto de perfil (multipart/form-data). O backend
// trata do upload para o Supabase Storage e devolve o User já atualizado
// com o avatarUrl novo.
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await api.post<User>('/auth/me/avatar', formData, {
    // O cliente axios tem 'Content-Type: application/json' fixo por omissão;
    // ao pôr undefined aqui, deixamos o browser definir o boundary correto
    // do multipart automaticamente.
    headers: { 'Content-Type': undefined },
  });
  return response.data;
};

// Remove a foto de perfil atual (volta a mostrar as iniciais).
export const removeAvatar = async (): Promise<User> => {
  const response = await api.delete<User>('/auth/me/avatar');
  return response.data;
};

export const deleteAccount = async (): Promise<void> => {
  await api.delete('/auth/me');
};

// ADMIN USER MANAGEMENT ENDPOINTS (todos exigem ADMIN no backend)

// Uma pagina de utilizadores (pesquisa, filtros e ordem no
// servidor). `cursor` e o nextCursor da pagina anterior.
export const getUsersPage = async (
  query: UsersPageQuery,
  signal?: AbortSignal,
): Promise<{ items: User[]; nextCursor: string | null }> => {
  const response = await api.get<{ items: User[]; nextCursor: string | null }>('/users', {
    params: { ...query, paginated: true },
    signal,
  });
  return response.data;
};

// Muda o nome e/ou a role de outro utilizador. O backend recusa se estiveres
// a tentar mudar a tua própria role (evita ficares sem nenhum admin ativo).
export const updateUser = async (
  id: string,
  data: { name?: string; role?: Role },
): Promise<User> => {
  const response = await api.patch<User>(`/users/${id}`, data);
  return response.data;
};

// Apaga em definitivo a conta de outro utilizador. O backend recusa se
// tentares apagar a tua própria conta por aqui (usa "Delete account" no
// Profile para isso).
export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

// Suspensão temporária (backend exige `until` no futuro e `reason` não
// vazio) - o backend recusa contra a própria conta do admin.
export const suspendUser = async (
  id: string,
  data: { reason: string; until: string },
): Promise<User> => {
  const response = await api.post<User>(`/users/${id}/suspend`, data);
  return response.data;
};

// Banimento permanente - mesma regra de "não contra ti próprio".
export const banUser = async (id: string, reason: string): Promise<User> => {
  const response = await api.post<User>(`/users/${id}/ban`, { reason });
  return response.data;
};

// Levanta um ban ou termina uma suspensão antes do tempo, voltando a
// ACTIVE.
export const reactivateUser = async (id: string): Promise<User> => {
  const response = await api.post<User>(`/users/${id}/reactivate`);
  return response.data;
};

// Exportação de dados (portabilidade GDPR) de um utilizador, usado tanto
// para um admin exportar os dados de qualquer pessoa, como para o próprio
// exportar os seus. Devolve o JSON completo pronto a descarregar.
export const exportUserData = async (id: string): Promise<Record<string, unknown>> => {
  const response = await api.get<Record<string, unknown>>(`/users/${id}/export`);
  return response.data;
};

export const exportMyData = async (): Promise<unknown> => {
  const response = await api.get('/users/me/export');
  return response.data;
};
