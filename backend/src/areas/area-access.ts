import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Uma Area é utilizável por um user se for OFICIAL (ownerId = null) ou se
 * for PRIVADA e dele. Esta é a ÚNICA definição de "acesso a uma Area" no
 * backend: qualquer sítio que aceite um areaId vindo do cliente (tasks,
 * sessões de estudo, caderno, componentes de nota, interesses...) tem de
 * passar por aqui, senão um user consegue ligar dados ao catálogo privado
 * de outro só adivinhando o UUID (IDOR).
 */
export function accessibleAreaWhere(userId: string): Prisma.AreaWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: userId }] };
}

/**
 * Lança 404 (nunca 403) se a Area não existir OU for privada de outro user:
 * a resposta é igual nos dois casos para não revelar que o UUID existe.
 */
export async function assertAreaAccessible(
  prisma: Pick<PrismaService, 'area'>,
  userId: string,
  areaId: string,
): Promise<void> {
  const area = await prisma.area.findFirst({
    where: { id: areaId, ...accessibleAreaWhere(userId) },
    select: { id: true },
  });
  if (!area) throw new NotFoundException('Area not found.');
}
