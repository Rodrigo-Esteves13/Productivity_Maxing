import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Quanto tempo o papel/versao de um utilizador ficam em memoria. E o maximo
// que uma despromocao ou um logout feito noutra instancia demora a chegar
// aqui; na MESMA instancia o efeito e imediato, porque quem altera chama
// invalidate() / bumpTokenVersion().
const CACHE_TTL_MS = 30_000;
const MAX_CACHED_USERS = 5_000;

export interface SessionState {
  role: Role;
  tokenVersion: number;
}

interface CachedState extends SessionState {
  expiresAt: number;
}

interface CachedDeviceSession {
  userId: string;
  active: boolean;
  expiresAt: number;
}

/**
 * O que o JwtStrategy precisa de saber a cada pedido e que NAO pode vir do
 * proprio JWT: o papel atual (para uma despromocao valer logo) e a versao
 * das sessoes (para um logout/troca de password invalidar tokens antigos).
 * Vive junto de AccountStatusService, pelo mesmo motivo (evita o ciclo
 * AuthModule <-> UsersModule).
 */
@Injectable()
export class SessionStateService {
  private cache = new Map<string, CachedState>();
  // Estado de cada sessao de dispositivo (UserSession) referida pela claim
  // `sid` do JWT. Mesmo TTL e mesmo limite da cache de utilizadores: revogar
  // um dispositivo vale logo nesta instancia (invalidateDeviceSession) e em
  // ate 30s nas outras.
  private deviceSessions = new Map<string, CachedDeviceSession>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A sessao de dispositivo `sessionId` ainda vale para `userId`? Falso se
   * nao existe, e de outro utilizador, foi revogada ou o refresh expirou.
   */
  async isDeviceSessionActive(
    sessionId: string,
    userId: string,
    now: number = Date.now(),
  ): Promise<boolean> {
    const hit = this.deviceSessions.get(sessionId);
    if (hit && hit.expiresAt > now) {
      return hit.active && hit.userId === userId;
    }

    const row = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    const active =
      !!row && row.revokedAt === null && row.expiresAt.getTime() > now;

    if (this.deviceSessions.size >= MAX_CACHED_USERS) {
      this.deviceSessions.clear();
    }
    this.deviceSessions.set(sessionId, {
      userId: row?.userId ?? '',
      active,
      expiresAt: now + CACHE_TTL_MS,
    });
    return active && row?.userId === userId;
  }

  /** Esquece o estado em cache de uma sessao (ex: acabou de ser revogada). */
  invalidateDeviceSession(sessionId: string): void {
    this.deviceSessions.delete(sessionId);
  }

  /** Idem para todas as sessoes de um utilizador (revogacao em bloco). */
  invalidateDeviceSessionsOfUser(userId: string): void {
    for (const [sessionId, entry] of this.deviceSessions) {
      if (entry.userId === userId) this.deviceSessions.delete(sessionId);
    }
  }

  /** Estado atual do utilizador, ou null se a conta ja nao existe. */
  async get(
    userId: string,
    now: number = Date.now(),
  ): Promise<SessionState | null> {
    const hit = this.cache.get(userId);
    if (hit && hit.expiresAt > now) {
      return { role: hit.role, tokenVersion: hit.tokenVersion };
    }

    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tokenVersion: true },
    });
    if (!row) {
      this.cache.delete(userId);
      return null;
    }

    // Limite simples: se encher (muitos utilizadores ativos), recomeca.
    if (this.cache.size >= MAX_CACHED_USERS) this.cache.clear();
    this.cache.set(userId, { ...row, expiresAt: now + CACHE_TTL_MS });
    return row;
  }

  /** Esquece o estado em cache (ex: o papel mudou ou a conta foi apagada). */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Invalida TODAS as sessoes do utilizador: sobe a versao na BD e devolve o
   * utilizador atualizado, para quem chama poder emitir logo um token novo
   * (com a versao nova) para a sessao que deve continuar.
   *
   * `client`: dentro de uma transacao (ver SessionTokenService.
   * revokeAllSessions), quem chama tem de voltar a invalidar a cache DEPOIS
   * do commit: a invalidacao daqui corre antes, e um pedido entretanto podia
   * voltar a guardar a versao antiga.
   */
  async bumpTokenVersion(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<User> {
    const updated = await client.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.invalidate(userId);
    return updated;
  }
}
