import type { Prisma, PrismaClient } from '@prisma/client';

type TaskDelegateClient = Pick<PrismaClient, '$transaction'> & {
  task: Pick<Prisma.TaskDelegate, 'updateMany'>;
};

/**
 * Move varias tasks do mesmo user para a mesma data (BulkRescheduleDto).
 * Mesma regra do update() para o contador "adiada Nx": so conta quando a
 * data nova e MAIS TARDE que a antiga, por isso sao dois updateMany (as
 * que avancam incrementam postponedCount, as que recuam nao). Tasks ja
 * concluidas ficam onde estao - reagendar so faz sentido para o que falta.
 * where tem sempre userId: ids de outro user simplesmente nao batem.
 */
export async function bulkRescheduleTasks(
  prisma: TaskDelegateClient,
  userId: string,
  ids: string[],
  date: Date,
): Promise<{ count: number }> {
  const scope = {
    id: { in: ids },
    userId,
    progressStatus: { not: 'COMPLETED' as const },
  };
  const [postponed, movedEarlier] = await prisma.$transaction([
    prisma.task.updateMany({
      where: { ...scope, date: { lt: date } },
      data: { date, postponedCount: { increment: 1 } },
    }),
    prisma.task.updateMany({
      where: { ...scope, date: { gte: date } },
      data: { date },
    }),
  ]);
  return { count: postponed.count + movedEarlier.count };
}
