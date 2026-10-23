import type { SupabaseClient } from '@supabase/supabase-js';
import { TurmaRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { getNotebookAttachmentsBucket } from '../config/app.config';

type CleanupPrisma = Pick<PrismaService, 'turmaMember' | 'turmaFile' | 'turma'>;

// Chamado ao apagar uma conta (AuthService.deleteAccount), ANTES de apagar o
// utilizador. O cascade so tira a linha de TurmaMember; sem isto:
// - uma turma em que a pessoa era o unico membro ficava orfa, com os
//   ficheiros para sempre no storage;
// - uma turma cujo delegado apagou a conta ficava sem delegado ate alguem a
//   abrir (TurmasService.ensureDelegado).
// Funcao solta, nao servico: o AuthModule nao pode importar o TurmasModule
// (que ja importa o AuthModule).
export async function releaseTurmasOfDeletedUser(
  prisma: CleanupPrisma,
  storage: Pick<SupabaseClient, 'storage'>,
  userId: string,
): Promise<void> {
  const memberships = await prisma.turmaMember.findMany({
    where: { userId },
    select: { turmaId: true, role: true },
  });

  for (const { turmaId, role } of memberships) {
    const successor = await prisma.turmaMember.findFirst({
      where: { turmaId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
      select: { id: true },
    });

    if (!successor) {
      await deleteTurmaWithFiles(prisma, storage, turmaId);
    } else if (role === TurmaRole.DELEGADO) {
      await prisma.turmaMember.update({
        where: { id: successor.id },
        data: { role: TurmaRole.DELEGADO },
      });
    }
  }
}

async function deleteTurmaWithFiles(
  prisma: CleanupPrisma,
  storage: Pick<SupabaseClient, 'storage'>,
  turmaId: string,
): Promise<void> {
  const files = await prisma.turmaFile.findMany({
    where: { turmaId },
    select: { storagePath: true },
  });
  if (files.length > 0) {
    const { error } = await storage.storage
      .from(getNotebookAttachmentsBucket())
      .remove(files.map((file) => file.storagePath));
    // Falhar aqui aborta o apagar da conta antes de qualquer passo
    // irreversivel (ver a ordem em AuthService.deleteAccount).
    if (error) throw error;
  }
  await prisma.turma.delete({ where: { id: turmaId } });
}
