import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { Prisma, Provider, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decryptTokenNullable,
  encryptToken,
  encryptTokenNullable,
} from '../../crypto/token-cipher';
import { SessionStateService } from '../../account-status/session-state.service';
import { OAuthAccountConflictException } from '../exceptions/oauth-account-conflict.exception';
import { GOOGLE_REVOKE_URL } from '../google-oauth.constants';
import { neutralizePreexistingCredential } from '../oauth-merge.policy';
import { AccountGuardService } from './account-guard.service';
import type { OAuthProfileData } from './oauth-profile.interface';
import { SupabaseClientsService } from './supabase-clients.service';

// Login/registo e "ligar conta" via OAuth (Google, GitHub, Discord), e a
// gestao dos tokens OAuth guardados (cifrados) em Identity.
@Injectable()
export class OAuthIdentityService {
  private readonly logger = new Logger(OAuthIdentityService.name);

  constructor(
    private prisma: PrismaService,
    private clients: SupabaseClientsService,
    private sessionState: SessionStateService,
    private accountGuard: AccountGuardService,
  ) {}

  /**
   * Fluxo normal de login/registo via OAuth.
   * Ordem de resolução: Identity existente -> User por email (SÓ se
   * emailVerified) -> criar User novo.
   *
   * CORREÇÃO DE SEGURANÇA: antes, qualquer email vindo do provider fazia
   * merge automático com um User existente, mesmo sem confirmação de que o
   * provider validou a posse desse email. Um atacante com uma conta OAuth
   * cujo email (não verificado) coincidisse com o de uma vítima conseguia
   * assim tornar-se "dono" da conta dela. Agora só fazemos o merge se o
   * provider confirmar explicitamente `emailVerified === true` (nunca
   * acontece para Discord, que não expõe esse campo) - caso contrário
   * criamos sempre um User novo, e a pessoa pode ligar as contas mais tarde
   * através do fluxo explícito de "Ligar conta" (linkIdentity), que exige
   * já estar autenticada.
   */
  async resolveIdentity(data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          // CORREÇÃO DE SEGURANÇA: accessToken/refreshToken passam sempre
          // por encryptToken() antes de tocar na BD - um dump direto do
          // Postgres do Supabase (backup, RLS mal configurada, etc.) já não
          // expõe os tokens OAuth em texto plano, só o valor cifrado.
          // Mantém o mesmo comportamento de antes quando o provider não
          // manda um accessToken novo (undefined -> não mexe no valor
          // guardado, em vez de o apagar).
          accessToken: data.accessToken
            ? encryptToken(data.accessToken)
            : existingIdentity.accessToken,
          // o Google só manda refresh_token no primeiro consent; não sobrescrever com undefined
          refreshToken: data.refreshToken
            ? encryptToken(data.refreshToken)
            : existingIdentity.refreshToken,
          // Nunca sobrescrever com undefined - se este consent não trouxe
          // scope novo (ou o provider não expõe scope), mantém o que já
          // estava guardado.
          scope: data.scope ?? existingIdentity.scope,
        },
      });

      // Só preenche o avatarUrl se o utilizador ainda não tiver nenhum -
      // nunca sobrescreve um avatar carregado manualmente (uploadAvatar em
      // auth.service.ts) nem um já preenchido por um provider anterior.
      this.accountGuard.assertAccountIsUsable(existingIdentity.user);

      if (!existingIdentity.user.avatarUrl && data.photo) {
        return this.prisma.user.update({
          where: { id: existingIdentity.user.id },
          data: { avatarUrl: data.photo },
        });
      }

      return existingIdentity.user;
    }

    let user = data.emailVerified
      ? await this.prisma.user.findUnique({ where: { email: data.email } })
      : null;
    // Funde-se numa conta que ja existia (em vez de criar uma nova).
    const mergedIntoExisting = user !== null;

    if (!user) {
      // BUG CORRIGIDO: quando o email não é verificado (Discord nunca é;
      // GitHub às vezes), o código anterior tentava sempre criar um User
      // novo, sem verificar se já existia um com esse email - se existisse
      // (ex: conta feita com Google, ou por password), o Prisma rebentava
      // com P2002 (unique constraint) e o pedido falhava com um 500 feio.
      //
      // A correção NÃO é voltar a fazer auto-merge (era a vulnerabilidade
      // de account takeover que já corrigimos) - é só detetar a colisão e
      // devolver um erro claro, a dizer ao utilizador para entrar pelo
      // método original e ligar esta conta manualmente depois, a partir
      // das definições do perfil (fluxo linkIdentity(), que exige sessão
      // válida antes de associar o provider).
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (emailTaken) {
        throw new OAuthAccountConflictException(data.email);
      }

      try {
        user = await this.prisma.user.create({
          data: {
            id: randomUUID(),
            email: data.email,
            name: data.name,
            avatarUrl: data.photo,
          },
        });
      } catch (err: unknown) {
        // Corrida rara: dois logins simultâneos passam ambos o check acima
        // antes de qualquer um dos dois criar o User. Apanhamos o P2002
        // aqui também, em vez de deixar subir como erro genérico não tratado.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new OAuthAccountConflictException(data.email);
        }
        throw err;
      }
    }

    // `user` já existia (email verificado a bater com uma conta anterior)
    // ou acabou de ser criado agora mesmo - só faz sentido verificar no
    // primeiro caso, mas chamar sempre é inofensivo (uma conta recém-criada
    // nunca é BANNED/SUSPENDED).
    this.accountGuard.assertAccountIsUsable(user);

    if (mergedIntoExisting) {
      // SCR-001: ver oauth-merge.policy.ts. O registo por password nao
      // exige confirmacao de email, por isso o email verificado pelo
      // provider e que prova quem e o dono da conta.
      user = await neutralizePreexistingCredential(
        {
          replacePassword: async (supabaseAuthId, newPassword) => {
            const { error } = await this.clients.admin.auth.admin.updateUserById(
              supabaseAuthId,
              { password: newPassword },
            );
            return error
              ? {
                  message: error.message,
                  status: error.status,
                  code: error.code,
                }
              : null;
          },
          revokeSessions: (userId) =>
            this.sessionState.bumpTokenVersion(userId),
          generatePassword: () => randomBytes(32).toString('hex'),
        },
        user,
        await this.prisma.identity.count({ where: { userId: user.id } }),
      );
    }

    await this.prisma.identity.create({
      data: {
        userId: user.id,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        accessToken: encryptTokenNullable(data.accessToken),
        refreshToken: encryptTokenNullable(data.refreshToken),
        scope: data.scope ?? null,
      },
    });

    return user;
  }

  /**
   * Fluxo de "ligar conta": utilizador já autenticado (identificado pelo state
   * assinado, ver createLinkState/consumeLinkState) associa um novo provider
   * ao seu User existente, em vez de criar/procurar por email.
   */
  async linkIdentity(userId: string, data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
    });

    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException(
        'This provider account is already linked to another user.',
      );
    }

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          // Mesma cifragem aplicada em resolveIdentity() - ver comentário lá.
          // E o mesmo cuidado: se o provider não reenviar um token novo
          // (undefined), preserva o valor cifrado já existente em vez de o
          // apagar - não usar encryptTokenNullable() diretamente aqui, pois
          // devolveria `null` explícito e sobrescreveria o token guardado.
          accessToken: data.accessToken
            ? encryptToken(data.accessToken)
            : existingIdentity.accessToken,
          refreshToken: data.refreshToken
            ? encryptToken(data.refreshToken)
            : existingIdentity.refreshToken,
          scope: data.scope ?? existingIdentity.scope,
        },
      });
    } else {
      await this.prisma.identity.create({
        data: {
          userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: encryptTokenNullable(data.accessToken),
          refreshToken: encryptTokenNullable(data.refreshToken),
          scope: data.scope ?? null,
        },
      });
    }

    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  /**
   * Decifra os tokens OAuth de uma Identity para uso interno do próprio
   * backend (ex: chamar a Google Calendar API na sincronização da Fase 4).
   * NUNCA deve ser chamado a partir de um controller que devolve o
   * resultado diretamente ao cliente - accessToken/refreshToken em claro
   * não podem sair do processo do servidor.
   */
  async getDecryptedProviderTokens(
    userId: string,
    provider: Provider,
  ): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  } | null> {
    const record = await this.prisma.identity.findFirst({
      where: { userId, provider },
    });

    if (!record) return null;

    return {
      accessToken: decryptTokenNullable(record.accessToken),
      refreshToken: decryptTokenNullable(record.refreshToken),
    };
  }

  /**
   * Issue #38: "Disconnect Google Calendar". Revoga o refresh token junto da
   * Google (para ele deixar de ser válido do lado deles também, não só
   * deixarmos de o usar) e limpa refreshToken/scope na nossa Identity - a
   * Identity em si fica (login com Google continua a funcionar, só o
   * acesso ao Calendar é que é removido).
   *
   * Não apaga accessToken: continua válido por ~1h e não dá acesso a nada
   * que o login normal já não desse; só o refreshToken é sensível a longo
   * prazo.
   */
  async disconnectGoogleCalendar(userId: string): Promise<void> {
    const identity = await this.prisma.identity.findFirst({
      where: { userId, provider: Provider.GOOGLE },
    });

    if (!identity) return;

    const refreshToken = decryptTokenNullable(identity.refreshToken);

    if (refreshToken) {
      try {
        const res = await fetch(GOOGLE_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refreshToken }),
        });
        // Best-effort: se a Google já não reconhece o token (ex: pessoa
        // revogou manualmente em myaccount.google.com/permissions antes),
        // não bloqueamos a limpeza local por causa disso.
        if (!res.ok) {
          this.logger.warn(
            `Revoke do refresh token Google devolveu ${res.status} a continuar com a limpeza local.`,
          );
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Falha ao contactar o endpoint revoke da Google: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.prisma.identity.update({
      where: { id: identity.id },
      data: { refreshToken: null, scope: null },
    });
  }
}
