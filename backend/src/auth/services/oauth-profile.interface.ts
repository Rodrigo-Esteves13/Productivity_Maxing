import type { Provider } from '@prisma/client';

export interface OAuthProfileData {
  provider: Provider;
  providerAccountId: string;
  email: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  // Se o provider confirma que o email pertence mesmo à pessoa (Google e
  // GitHub expõem isto; Discord não tem este campo, por isso a strategy do
  // Discord nunca deve passar `true` aqui). Só emails verified podem
  // fazer auto-merge com uma conta local existente.
  emailVerified: boolean;
  // Scope space-separated devolvido pela Google no token exchange. Undefined
  // nos providers que não expõem isto (GitHub/Discord nunca passam isto) -
  // usado pelo CalendarService para saber se esta Identity já tem acesso
  // ao Google Calendar, sem precisar de chamar a Google.
  scope?: string;
  // URL da foto de perfil devolvida pelo provider (Google/GitHub/Discord).
  // Só usada para preencher o avatarUrl automaticamente - nunca sobrescreve
  // um avatar que o próprio utilizador já tenha carregado manualmente
  // (ver resolveIdentity()).
  photo?: string;
}
