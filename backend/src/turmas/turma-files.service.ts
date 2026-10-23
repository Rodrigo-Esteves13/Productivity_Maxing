import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getNotebookAttachmentsBucket } from '../config/app.config';
import {
  validateAttachmentUpload,
  withDownloadName,
} from '../notebook/attachment-validation.util';
import { TurmaAccessService } from './turma-access.service';
import { MAX_FILES_PER_TURMA } from './turmas.constants';

// Mesmo bucket privado dos anexos do Notebook, numa pasta propria.
const FILES_BUCKET = getNotebookAttachmentsBucket();
const STORAGE_PREFIX = 'turmas';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const FILE_SELECT = {
  id: true,
  storagePath: true,
  originalFileName: true,
  extension: true,
  sizeBytes: true,
  createdAt: true,
  uploadedById: true,
  uploadedBy: { select: { name: true } },
} as const;

export interface TurmaFileView {
  id: string;
  originalFileName: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById: string | null;
  uploadedByName: string | null;
  url: string | null;
}

@Injectable()
export class TurmaFilesService {
  private readonly logger = new Logger(TurmaFilesService.name);
  private readonly storage: ReturnType<typeof createClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
  ) {
    this.storage = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  async list(userId: string, turmaId: string): Promise<TurmaFileView[]> {
    await this.access.requireMember(userId, turmaId);
    const files = await this.prisma.turmaFile.findMany({
      where: { turmaId },
      orderBy: { createdAt: 'desc' },
      select: FILE_SELECT,
    });
    const urls = await this.signPaths(files.map((f) => f.storagePath));
    return files.map(({ storagePath, uploadedBy, createdAt, ...file }) => {
      const url = urls.get(storagePath) ?? null;
      return {
        ...file,
        createdAt: createdAt.toISOString(),
        uploadedByName: uploadedBy?.name ?? null,
        url: url && withDownloadName(url, file.originalFileName),
      };
    });
  }

  async upload(
    userId: string,
    turmaId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    await this.access.requireMember(userId, turmaId);
    const count = await this.prisma.turmaFile.count({ where: { turmaId } });
    if (count >= MAX_FILES_PER_TURMA) {
      throw new BadRequestException(
        `A turma can have at most ${MAX_FILES_PER_TURMA} files.`,
      );
    }

    const { originalFileName, ext, content, contentType } =
      await validateAttachmentUpload(file);
    // Caminho sempre gerado no servidor, nunca a partir do nome enviado.
    const path = `${STORAGE_PREFIX}/${turmaId}/${randomUUID()}.${ext}`;
    const { error } = await this.storage.storage
      .from(FILES_BUCKET)
      .upload(path, content, { contentType, upsert: false });
    if (error) {
      this.logger.error(`Error uploading turma file: ${error.message}`);
      throw new BadRequestException(
        'Could not upload the file. Please try again.',
      );
    }

    const created = await this.prisma.turmaFile.create({
      data: {
        turmaId,
        uploadedById: userId,
        storagePath: path,
        originalFileName,
        extension: ext,
        sizeBytes: content.length,
      },
      select: { id: true },
    });
    return created;
  }

  async remove(userId: string, turmaId: string, fileId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const file = await this.prisma.turmaFile.findFirst({
      where: { id: fileId, turmaId },
      select: { id: true, storagePath: true, uploadedById: true },
    });
    if (!file) throw new NotFoundException('File not found.');
    this.access.assertDelegadoOrAuthor(membership, userId, file.uploadedById);

    await this.removeFromStorage([file.storagePath]);
    await this.prisma.turmaFile.delete({ where: { id: file.id } });
    return { deleted: true };
  }

  // Antes de apagar a turma (o cascade so apaga as linhas, nao o storage).
  async removeAllFor(turmaId: string): Promise<void> {
    const files = await this.prisma.turmaFile.findMany({
      where: { turmaId },
      select: { storagePath: true },
    });
    if (files.length > 0) {
      await this.removeFromStorage(files.map((f) => f.storagePath));
    }
  }

  private async removeFromStorage(paths: string[]): Promise<void> {
    const { error } = await this.storage.storage
      .from(FILES_BUCKET)
      .remove(paths);
    if (error) {
      this.logger.error(`Error deleting turma files: ${error.message}`);
      throw new BadRequestException(
        'Could not delete the file. Please try again.',
      );
    }
  }

  private async signPaths(paths: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (paths.length === 0) return urls;
    const { data, error } = await this.storage.storage
      .from(FILES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) {
      this.logger.warn(`Could not sign turma file URLs: ${error.message}`);
      return urls;
    }
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }
}
