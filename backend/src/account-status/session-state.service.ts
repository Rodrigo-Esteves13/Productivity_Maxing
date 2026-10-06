import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
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

  constructor(private readonly prisma: PrismaService) {}

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
   */
  async bumpTokenVersion(userId: string): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.invalidate(userId);
    return updated;
  }
}
