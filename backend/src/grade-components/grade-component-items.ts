import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  componentsToGradedItems,
  type ComponentGradedItem,
} from './grade-component.util';

/**
 * Carrega os componentes de nota que cumprem `where` e devolve-os como
 * itens avaliados (realGrade + weightPercentage + areaId), para juntar as
 * tasks avaliadas nas medias (periodo, programa, creditos). So precisa do
 * PrismaService - sem modulo, para nao criar dependencias circulares com
 * AcademicProgramsModule.
 */
export async function loadComponentGradedItems(
  prisma: PrismaService,
  where: Prisma.GradeComponentWhereInput,
): Promise<ComponentGradedItem[]> {
  const rows = await prisma.gradeComponent.findMany({
    where,
    select: {
      areaId: true,
      periodId: true,
      weightPercentage: true,
      aggregation: true,
      bestOfCount: true,
      entries: { select: { grade: true } },
    },
  });
  return componentsToGradedItems(
    rows.map((row) => ({
      ...row,
      aggregation: row.aggregation,
    })),
  );
}
