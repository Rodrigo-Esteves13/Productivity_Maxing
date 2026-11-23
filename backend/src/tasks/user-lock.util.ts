import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { LONG_TRANSACTION_TIMEOUT_MS } from '../common/time.constants';

// Timeout das transacoes que seguram o lock de escrita de tasks de um user.
// Inclui o import (uma folha inteira num so INSERT), por isso o valor longo.
export const TASK_WRITE_TRANSACTION_TIMEOUT_MS = LONG_TRANSACTION_TIMEOUT_MS;

/**
 * Lock por utilizador ate ao fim da transacao (B-42). Serializa as escritas
 * de tasks do mesmo user: validar o peso (limite de 100% por cadeira) e
 * calcular o proximo sortOrder ficam atomicos com o insert.
 *
 * $executeRaw e nao $queryRaw: pg_advisory_xact_lock devolve void e o
 * $queryRaw do Prisma nao sabe ler colunas void. Tagged template: o userId
 * vai sempre como parametro, nunca concatenado no SQL.
 *
 * O lock e reentrante na mesma transacao, por isso pedir de novo dentro de
 * uma transacao que ja o tem nao bloqueia.
 */
export async function lockUserTaskWrites(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

/**
 * Corre `work` com o lock de escrita de tasks do user. Com `tx` (chamada
 * aninhada, ja dentro de uma transacao do chamador) reutiliza-a em vez de
 * abrir outra: nunca transacao dentro de transacao nem deadlock contra a
 * propria ligacao.
 */
export async function runWithUserTaskLock<T>(
  prisma: PrismaService,
  userId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  tx?: Prisma.TransactionClient,
): Promise<T> {
  if (tx) {
    await lockUserTaskWrites(tx, userId);
    return work(tx);
  }
  return prisma.$transaction(
    async (inner) => {
      await lockUserTaskWrites(inner, userId);
      return work(inner);
    },
    { timeout: TASK_WRITE_TRANSACTION_TIMEOUT_MS },
  );
}

/** Proximo sortOrder da ordem manual do user (fim da lista, nunca 0). */
export async function nextTaskSortOrder(
  db: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const max = await db.task.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  return (max._max.sortOrder ?? 0) + 1;
}
