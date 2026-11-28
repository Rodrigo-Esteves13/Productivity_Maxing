import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

// Campos de uma task do dono que sao copiados para um item de pacote.
const PACK_SOURCE_SELECT = {
  id: true,
  title: true,
  date: true,
  weightPercentage: true,
  effort: true,
  dateCertainty: true,
  availableFrom: true,
  isBlocked: true,
  submissionDate: true,
  areaId: true,
  area: { select: { name: true, ownerId: true } },
  taskType: { select: { key: true } },
  academicType: { select: { key: true } },
} satisfies Prisma.TaskSelect;

export type PackSourceTask = Prisma.TaskGetPayload<{
  select: typeof PACK_SOURCE_SELECT;
}>;

/** So tarefas do proprio dono (IDOR): ids de outros dao 404. */
export async function findOwnPackSources(
  prisma: PrismaService,
  ownerId: string,
  taskIds: string[],
): Promise<PackSourceTask[]> {
  const tasks = await prisma.task.findMany({
    where: { userId: ownerId, id: { in: taskIds } },
    select: PACK_SOURCE_SELECT,
  });
  if (tasks.length !== taskIds.length) {
    throw new NotFoundException('Some of those tasks were not found.');
  }
  return tasks;
}

export function packItemFromTask(t: PackSourceTask, position: number) {
  return {
    position,
    title: t.title,
    dueDate: t.date,
    weightPercentage: t.weightPercentage,
    // So Areas oficiais sao iguais para toda a gente; o id de uma Area
    // pessoal nunca sai da conta do dono.
    areaId: t.area.ownerId === null ? t.areaId : null,
    areaName: t.area.name,
    taskType: t.taskType.key,
    academicType: t.academicType?.key ?? null,
    // Iguais para toda a turma: quanto trabalho da, se a data ja esta
    // marcada, quando o enunciado sai e se ainda nao da para comecar.
    effort: t.effort,
    dateCertainty: t.dateCertainty,
    availableFrom: t.availableFrom,
    isBlocked: t.isBlocked,
    // Duas fases (entregar e depois apresentar): igual para a turma.
    submissionDate: t.submissionDate,
    // Para o dono poder publicar alteracoes mais tarde (ver
    // TaskPackSyncService.publish).
    sourceTaskId: t.id,
  };
}
