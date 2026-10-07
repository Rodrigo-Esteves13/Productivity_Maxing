import { Injectable } from '@nestjs/common';
import { ApiKeyScope, CommuteMode, Provider, Role, User } from '@prisma/client';
import 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { SessionStateService } from '../account-status/session-state.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ApiKeyService } from './services/api-key.service';
import { AvatarService } from './services/avatar.service';
import { OAuthIdentityService } from './services/oauth-identity.service';
import type { OAuthProfileData } from './services/oauth-profile.interface';
import { PasswordAuthService } from './services/password-auth.service';
import { SessionTokenService } from './services/session-token.service';
import { SupabaseClientsService } from './services/supabase-clients.service';

/**
 * Fachada do modulo de autenticacao. A implementacao vive em servicos
 * pequenos (pasta ./services), cada um com uma responsabilidade:
 * - OAuthIdentityService: login/registo e "ligar conta" via OAuth
 * - PasswordAuthService: email + password (Supabase Auth), recuperacao
 * - AvatarService: foto de perfil
 * - SessionTokenService: JWT, CSRF, state do "ligar conta"
 * - ApiKeyService: API Keys
 * - AccountGuardService: regras de conta banida/suspensa (usado pelos dois
 *   fluxos de login)
 *
 * Esta classe mantem a API publica de sempre (controller, strategies e
 * outros modulos nao mudam) e so tem a logica que nao pertence a nenhum
 * dos servicos acima: perfil e apagar conta.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private clients: SupabaseClientsService,
    private sessionState: SessionStateService,
    private oauth: OAuthIdentityService,
    private password: PasswordAuthService,
    private avatars: AvatarService,
    private tokens: SessionTokenService,
    private apiKeys: ApiKeyService,
  ) {}

  // PERFIL (nome + avatar)

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      commuteMinutes?: number;
      commuteMode?: CommuteMode;
      homeAddress?: string;
      campusAddress?: string;
      quietHoursStart?: number;
      quietHoursEnd?: number;
    },
  ): Promise<User> {
    // Cada campo só entra no `data` do Prisma se veio mesmo no pedido -
    // um PATCH parcial (ex: só { quietHoursStart: 1380 }) nunca pode
    // apagar os outros campos que não foram enviados.
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.commuteMinutes !== undefined
          ? { commuteMinutes: data.commuteMinutes }
          : {}),
        ...(data.commuteMode !== undefined
          ? { commuteMode: data.commuteMode }
          : {}),
        ...(data.homeAddress !== undefined
          ? { homeAddress: data.homeAddress }
          : {}),
        ...(data.campusAddress !== undefined
          ? { campusAddress: data.campusAddress }
          : {}),
        ...(data.quietHoursStart !== undefined
          ? { quietHoursStart: data.quietHoursStart }
          : {}),
        ...(data.quietHoursEnd !== undefined
          ? { quietHoursEnd: data.quietHoursEnd }
          : {}),
      },
    });
  }

  /**
   * Apaga a conta em definitivo: remove o avatar do Storage, a credencial
   * real no Supabase Auth (se for uma conta email+password - contas só-OAuth
   * não têm nenhuma) e o User da BD. O `onDelete: Cascade` no schema.prisma
   * trata de Identity, Task e ApiKey automaticamente - não precisamos de
   * apagar cada tabela à mão aqui.
   *
   * A ordem importa: apagamos o Supabase Auth ANTES do User local. Se
   * fizéssemos ao contrário e o passo do Supabase falhasse a meio, ficava
   * uma conta "fantasma" sem espelho local mas ainda com login válido - o
   * mesmo bug que estamos a corrigir, só que pior (sem nenhum registo local
   * para se perceber que aquilo devia ter sido apagado).
   *
   * Isto é irreversível. O controller é responsável por limpar os cookies
   * de sessão depois de chamar isto.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.supabaseAuthId) {
      const { error } = await this.clients.admin.auth.admin.deleteUser(
        user.supabaseAuthId,
      );
      // "User not found" significa que já não existe do lado do Supabase
      // (ex: apagado manualmente antes) - nesse caso está tudo bem, seguimos
      // para apagar o resto. Qualquer outro erro é abortado, para nunca
      // ficarmos com o User local apagado mas a credencial ainda viva.
      if (error && !/not.*found/i.test(error.message)) {
        throw error;
      }
    }

    await this.avatars.deleteAvatarFileIfOwned(user.avatarUrl);

    await this.prisma.user.delete({ where: { id: userId } });
    // Sem isto, o JWT da conta apagada ainda passava ate a cache expirar.
    this.sessionState.invalidate(userId);
  }

  // --- OAuth (ver services/oauth-identity.service.ts) ---

  resolveIdentity(data: OAuthProfileData): Promise<User> {
    return this.oauth.resolveIdentity(data);
  }

  linkIdentity(userId: string, data: OAuthProfileData): Promise<User> {
    return this.oauth.linkIdentity(userId, data);
  }

  getDecryptedProviderTokens(
    userId: string,
    provider: Provider,
  ): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  } | null> {
    return this.oauth.getDecryptedProviderTokens(userId, provider);
  }

  disconnectGoogleCalendar(userId: string): Promise<void> {
    return this.oauth.disconnectGoogleCalendar(userId);
  }

  // --- Email + password (ver services/password-auth.service.ts) ---

  registerWithPassword(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    return this.password.registerWithPassword(data);
  }

  loginWithPassword(email: string, password: string): Promise<User> {
    return this.password.loginWithPassword(email, password);
  }

  forgotPassword(email: string): Promise<void> {
    return this.password.forgotPassword(email);
  }

  setPassword(userId: string, newPassword: string): Promise<void> {
    return this.password.setPassword(userId, newPassword);
  }

  // --- Avatar (ver services/avatar.service.ts) ---

  uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    return this.avatars.uploadAvatar(userId, file);
  }

  removeAvatar(userId: string): Promise<User> {
    return this.avatars.removeAvatar(userId);
  }

  // --- Tokens de sessao, CSRF e state OAuth (ver services/session-token.service.ts) ---

  verifyAccessTokenCookie(token: string | undefined): JwtPayload | null {
    return this.tokens.verifyAccessTokenCookie(token);
  }

  issueJwt(user: User): string {
    return this.tokens.issueJwt(user);
  }

  revokeAllSessions(userId: string): Promise<User> {
    return this.tokens.revokeAllSessions(userId);
  }

  generateCsrfToken(): string {
    return this.tokens.generateCsrfToken();
  }

  createLinkState(userId: string, provider: Provider): string {
    return this.tokens.createLinkState(userId, provider);
  }

  consumeLinkState(state: string, provider: Provider): string {
    return this.tokens.consumeLinkState(state, provider);
  }

  // --- API Keys (ver services/api-key.service.ts) ---

  listApiKeys(userId: string): ReturnType<ApiKeyService['listApiKeys']> {
    return this.apiKeys.listApiKeys(userId);
  }

  generateApiKey(
    userId: string,
    name: string,
    requestedScope: ApiKeyScope,
    requesterRole: Role,
  ): ReturnType<ApiKeyService['generateApiKey']> {
    return this.apiKeys.generateApiKey(
      userId,
      name,
      requestedScope,
      requesterRole,
    );
  }

  validateApiKey(
    incomingToken: string,
  ): Promise<{ user: User; scope: ApiKeyScope } | null> {
    return this.apiKeys.validateApiKey(incomingToken);
  }

  revokeApiKey(
    userId: string,
    keyId: string,
  ): ReturnType<ApiKeyService['revokeApiKey']> {
    return this.apiKeys.revokeApiKey(userId, keyId);
  }
}
