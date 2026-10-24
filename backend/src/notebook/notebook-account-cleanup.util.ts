import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrismaService } from '../prisma/prisma.service';
import {
  getNotebookAttachmentsBucket,
  getNotebookBucket,
} from '../config/app.config';

type CleanupPrisma = Pick<
  PrismaService,
  'notebookPhoto' | 'notebookAttachment'
>;

// Caminhos por pedido de remove() ao Storage (lotes pequenos, como o
// createSignedUrls do NotebookService).
const REMOVE_BATCH_SIZE = 500;

async function removeInBatches(
  storage: Pick<SupabaseClient, 'storage'>,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const { error } = await storage.storage
      .from(bucket)
      .remove(paths.slice(i, i + REMOVE_BATCH_SIZE));
    if (error) throw error;
  }
}

// Chamado ao apagar uma conta (AuthService.deleteAccount), ANTES de apagar o
// utilizador: o cascade apaga as linhas das entradas, fotos e anexos do
// caderno, mas nunca os ficheiros nos buckets. Lanca se o Storage falhar,
// para o apagar da conta abortar antes de qualquer passo irreversivel.
// Funcao solta pela mesma razao de releaseTurmasOfDeletedUser (o AuthModule
// nao importa o NotebookModule).
export async function removeNotebookFilesOfDeletedUser(
  prisma: CleanupPrisma,
  storage: Pick<SupabaseClient, 'storage'>,
  userId: string,
): Promise<void> {
  const ownEntry = { notebookEntry: { userId } };
  const [photos, attachments] = await Promise.all([
    prisma.notebookPhoto.findMany({
      where: ownEntry,
      select: { storagePath: true },
    }),
    prisma.notebookAttachment.findMany({
      where: ownEntry,
      select: { storagePath: true },
    }),
  ]);
  await removeInBatches(
    storage,
    getNotebookBucket(),
    photos.map((p) => p.storagePath),
  );
  await removeInBatches(
    storage,
    getNotebookAttachmentsBucket(),
    attachments.map((a) => a.storagePath),
  );
}
