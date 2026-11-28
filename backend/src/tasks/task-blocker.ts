import { BadRequestException } from '@nestjs/common';
import { ProgressStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

// Dependencias entre tasks: uma task pode esperar por OUTRA task do mesmo
// user (Task.blockedByTaskId). Enquanto a outra nao estiver concluida a task
// fica bloqueada (isBlocked); ao concluir a outra, desbloqueia sozinha.

// Quantos elos da cadeia se seguem a procurar ciclos (cadeias reais sao
// curtas; o limite impede um ciclo ja gravado de prender o pedido).
export const MAX_BLOCKER_CHAIN = 25;

/**
 * Valida o bloqueador escolhido para `taskId` (undefined em tasks novas):
 * tem de ser uma task do user, nao a propria e nao pode fechar um ciclo.
 * Devolve se o bloqueador ainda esta por concluir.
 */
export async function assertBlockerValid(
  prisma: PrismaService,
  userId: string,
  taskId: string | undefined,
  blockerId: string,
): Promise<{ blockerOpen: boolean }> {
  if (taskId && blockerId === taskId) {
    throw new BadRequestException('A task cannot wait for itself.');
  }
  const blocker = await prisma.task.findFirst({
    where: { id: blockerId, userId },
    select: { progressStatus: true, blockedByTaskId: true },
  });
  if (!blocker) throw new BadRequestException('Blocking task not found.');

  let nextId: string | null = blocker.blockedByTaskId;
  for (let hops = 0; taskId && nextId && hops < MAX_BLOCKER_CHAIN; hops++) {
    if (nextId === taskId) {
      throw new BadRequestException('Tasks cannot wait for each other.');
    }
    const next = await prisma.task.findFirst({
      where: { id: nextId, userId },
      select: { blockedByTaskId: true },
    });
    nextId = next?.blockedByTaskId ?? null;
  }
  return { blockerOpen: blocker.progressStatus !== ProgressStatus.COMPLETED };
}

/**
 * Ao concluir uma ou varias tasks, desbloqueia as tasks do user que
 * esperavam por elas.
 */
export async function unblockDependents(
  prisma: PrismaService,
  userId: string,
  taskIds: string | string[],
): Promise<number> {
  const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
  if (ids.length === 0) return 0;
  const result = await prisma.task.updateMany({
    where: { userId, blockedByTaskId: { in: ids }, isBlocked: true },
    data: { isBlocked: false },
  });
  return result.count;
}
