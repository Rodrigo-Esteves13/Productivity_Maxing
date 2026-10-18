import type { PrismaService } from '../prisma/prisma.service';

/** Amizade ACEITE entre duas pessoas (qualquer direcao). Fonte unica da regra. */
export async function areFriends(
  prisma: Pick<PrismaService, 'friendship'>,
  a: string,
  b: string,
): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}
