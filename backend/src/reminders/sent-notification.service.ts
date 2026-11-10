import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MS_PER_DAY } from '../common/time.constants';
import {
  PRISMA_FOREIGN_KEY_VIOLATION,
  PRISMA_UNIQUE_VIOLATION,
  type SentNotificationKind,
} from './sent-notification.constants';

/**
 * Dedupe duravel dos avisos periodicos (uma linha por [user, tipo, periodo]
 * em SentNotification). Substitui os Maps em memoria, que um restart do
 * Render (deploy, sleep) apagava e deixava reenviar o aviso.
 *
 * Uso: `claim` ANTES do envio (a unique constraint garante que so uma
 * execucao ganha, mesmo com duas instancias), `release` se nenhum canal
 * recebeu (a execucao seguinte tenta outra vez). `claimedUserIds` e o
 * pre-filtro em lote (1 query por pagina) para nao refazer o trabalho de quem
 * ja foi avisado.
 */
@Injectable()
export class SentNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** true se este pedido ficou com o marcador; false se ja existia. */
  async claim(
    userId: string,
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<boolean> {
    try {
      await this.prisma.sentNotification.create({
        data: { userId, kind, periodKey },
        select: { id: true },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === PRISMA_UNIQUE_VIOLATION ||
          err.code === PRISMA_FOREIGN_KEY_VIOLATION)
      ) {
        return false;
      }
      throw err;
    }
  }

  /** Marca varios users de uma vez, sem envio (ex: mes sem atividade). */
  async markMany(
    userIds: readonly string[],
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.sentNotification.createMany({
      data: userIds.map((userId) => ({ userId, kind, periodKey })),
      skipDuplicates: true,
    });
  }

  /** Desfaz um claim (nenhum dispositivo/SMTP recebeu). */
  async release(
    userId: string,
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<void> {
    await this.prisma.sentNotification.deleteMany({
      where: { userId, kind, periodKey },
    });
  }

  /** Dos users dados, os que ja tem o marcador deste tipo e periodo. */
  async claimedUserIds(
    userIds: readonly string[],
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.prisma.sentNotification.findMany({
      where: { userId: { in: [...userIds] }, kind, periodKey },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  /** Apaga marcadores com mais de `days` dias; devolve quantos apagou. */
  async purgeOlderThan(days: number, now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - days * MS_PER_DAY);
    const { count } = await this.prisma.sentNotification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }
}
