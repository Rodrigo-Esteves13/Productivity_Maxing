import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getNotebookAttachmentsBucket } from '../config/app.config';
import {
  validateAttachmentUpload,
  withDownloadName,
} from '../notebook/attachment-validation.util';

// Mesmo bucket privado dos anexos do Notebook e da Turma, numa pasta propria.
const FILES_BUCKET = getNotebookAttachmentsBucket();
const STORAGE_PREFIX = 'tasks';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const MAX_ATTACHMENTS_PER_TASK = 10;

const FILE_SELECT = {
  id: true,
  storagePath: true,
  originalFileName: true,
  extension: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export interface TaskAttachmentView {
  id: string;
  originalFileName: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
}

type StorageClient = Pick<SupabaseClient, 'storage'>;
type AttachmentPrisma = Pick<PrismaService, 'taskAttachment'>;

// Apaga do storage os ficheiros das tasks indicadas (ou de todas as do user,
// sem `taskIds`), ANTES de apagar as linhas: o cascade da BD nao chega ao
// bucket. Funcao solta para o AuthService.deleteAccount a poder usar sem
// importar o TasksModule. Lanca se o storage falhar, para o chamador
// decidir se aborta (apagar conta) ou so regista (apagar task).
export async function removeTaskAttachmentFiles(
  prisma: AttachmentPrisma,
  storage: StorageClient,
  userId: string,
  taskIds?: string[],
): Promise<void> {
  const files = await prisma.taskAttachment.findMany({
    where: { userId, ...(taskIds ? { taskId: { in: taskIds } } : {}) },
    select: { storagePath: true },
  });
  if (files.length === 0) return;
  const { error } = await storage.storage
    .from(FILES_BUCKET)
    .remove(files.map((f) => f.storagePath));
  if (error) throw error;
}

@Injectable()
export class TaskAttachmentsService {
  private readonly logger = new Logger(TaskAttachmentsService.name);
  private readonly storage: ReturnType<typeof createClient>;

  constructor(private readonly prisma: PrismaService) {
    this.storage = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  async list(userId: string, taskId: string): Promise<TaskAttachmentView[]> {
    await this.requireOwnedTask(userId, taskId);
    const files = await this.prisma.taskAttachment.findMany({
      where: { taskId, userId },
      orderBy: { createdAt: 'asc' },
      select: FILE_SELECT,
    });
    const urls = await this.signPaths(files.map((f) => f.storagePath));
    return files.map(({ storagePath, createdAt, ...file }) => {
      const url = urls.get(storagePath) ?? null;
      return {
        ...file,
        createdAt: createdAt.toISOString(),
        url: url && withDownloadName(url, file.originalFileName),
      };
    });
  }

  async upload(
    userId: string,
    taskId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    await this.requireOwnedTask(userId, taskId);
    const count = await this.prisma.taskAttachment.count({
      where: { taskId, userId },
    });
    if (count >= MAX_ATTACHMENTS_PER_TASK) {
      throw new BadRequestException(
        `A task can have at most ${MAX_ATTACHMENTS_PER_TASK} files.`,
      );
    }

    const { originalFileName, ext, content, contentType } =
      await validateAttachmentUpload(file);
    // Caminho sempre gerado no servidor, nunca a partir do nome enviado.
    const path = `${STORAGE_PREFIX}/${userId}/${randomUUID()}.${ext}`;
    const { error } = await this.storage.storage
      .from(FILES_BUCKET)
      .upload(path, content, { contentType, upsert: false });
    if (error) {
      this.logger.error(`Error uploading task attachment: ${error.message}`);
      throw new BadRequestException(
        'Could not upload the file. Please try again.',
      );
    }

    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        userId,
        storagePath: path,
        originalFileName,
        extension: ext,
        sizeBytes: content.length,
      },
      select: { id: true },
    });
  }

  async remove(userId: string, taskId: string, attachmentId: string) {
    const file = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId, userId },
      select: { id: true, storagePath: true },
    });
    if (!file) throw new NotFoundException('File not found.');

    const { error } = await this.storage.storage
      .from(FILES_BUCKET)
      .remove([file.storagePath]);
    if (error) {
      this.logger.error(`Error deleting task attachment: ${error.message}`);
      throw new BadRequestException(
        'Could not delete the file. Please try again.',
      );
    }
    await this.prisma.taskAttachment.delete({ where: { id: file.id } });
    return { deleted: true };
  }

  // Antes de apagar tasks (uma ou em massa). Best-effort como no Notebook:
  // um ficheiro orfao no bucket e melhor que uma task que nao se apaga.
  async removeFilesForTasks(userId: string, taskIds: string[]): Promise<void> {
    try {
      await removeTaskAttachmentFiles(
        this.prisma,
        this.storage,
        userId,
        taskIds,
      );
    } catch (err) {
      this.logger.warn(
        `Could not delete task attachments from storage: ${(err as Error).message}`,
      );
    }
  }

  private async requireOwnedTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found or no access.');
  }

  private async signPaths(paths: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (paths.length === 0) return urls;
    const { data, error } = await this.storage.storage
      .from(FILES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) {
      this.logger.warn(`Could not sign task attachment URLs: ${error.message}`);
      return urls;
    }
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }
}
