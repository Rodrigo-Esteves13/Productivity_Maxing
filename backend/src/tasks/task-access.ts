import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export const TASK_NOT_FOUND_MESSAGE = `Task not found or you don't have access.`;

type TaskShape = Pick<Prisma.TaskFindFirstArgs, 'select' | 'include'>;

/**
 * Unica definicao de "a task e minha?" (modelo de areas/area-access.ts).
 * Lanca 404 (nunca 403) se a task nao existir OU for de outro user, com a
 * mesma mensagem nos dois casos. `shape` aceita select/include do Prisma.
 */
export async function assertTaskOwned<T extends TaskShape = object>(
  prisma: Pick<PrismaService, 'task'>,
  userId: string,
  taskId: string,
  shape?: T,
): Promise<Prisma.TaskGetPayload<T>> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    ...(shape ?? {}),
  });
  if (!task) throw new NotFoundException(TASK_NOT_FOUND_MESSAGE);
  return task as unknown as Prisma.TaskGetPayload<T>;
}
