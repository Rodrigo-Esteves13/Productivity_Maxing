import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotebookEntryDto,
  UpdateNotebookEntryDto,
} from './dto/upsert-notebook-entry.dto';
import { UpsertScheduleLinkDto } from './dto/upsert-schedule-link.dto';

// Bucket dedicado, separado do de avatars, e NUNCA público - são
// apontamentos e fotos pessoais de aulas, não fotos de perfil. Tem de
// existir no projeto Supabase com "Public bucket" DESLIGADO; o acesso é
// sempre via signed URL de curta duração (ver attachSignedUrls).
const NOTEBOOK_BUCKET =
  process.env.SUPABASE_NOTEBOOK_BUCKET ?? 'notebook-photos';

// Tempo de vida do signed URL devolvido ao frontend - só precisa de
// sobreviver ao carregamento da página de uma entrada, nunca fica
// guardado em lado nenhum (nem na BD, nem no frontend entre navegações).
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

// Margem à volta do início/fim da aula em que ainda consideramos "aula
// agora" para efeitos de sugestão automática - chegar 10 min atrasado ou
// ainda estar a arrumar 10 min depois de acabar não deve fazer a
// sugestão desaparecer.
const CLASS_MATCH_MARGIN_MINUTES = 15;

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name);
  private readonly storage: ReturnType<typeof createClient>;

  constructor(private readonly prisma: PrismaService) {
    this.storage = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  // Area é catálogo global (ver schema.prisma) - aqui só confirmamos que
  // existe, nunca posse por user, tal como o resto da app trata Area.
  private async assertAreaExists(areaId: string): Promise<void> {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found.');
  }

  private async findOwnedEntryOrThrow(userId: string, id: string) {
    const entry = await this.prisma.notebookEntry.findFirst({
      where: { id, userId },
      include: { photos: { orderBy: { position: 'asc' } } },
    });
    if (!entry)
      throw new NotFoundException(
        `Notebook entry not found or you don't have access.`,
      );
    return entry;
  }

  // Troca cada storagePath por um signed URL fresco - nunca persistimos o
  // URL em si (expira), só o caminho no bucket.
  private async attachSignedUrls<
    T extends { photos: { id: string; storagePath: string }[] },
  >(
    entry: T,
  ): Promise<T & { photos: (T['photos'][number] & { url: string | null })[] }> {
    const photosWithUrls = await Promise.all(
      entry.photos.map(async (photo) => {
        const { data, error } = await this.storage.storage
          .from(NOTEBOOK_BUCKET)
          .createSignedUrl(photo.storagePath, SIGNED_URL_TTL_SECONDS);
        if (error) {
          this.logger.warn(
            `Could not sign URL for notebook photo ${photo.id}: ${error.message}`,
          );
        }
        return { ...photo, url: data?.signedUrl ?? null };
      }),
    );
    return { ...entry, photos: photosWithUrls };
  }

  async findAllForArea(userId: string, areaId: string) {
    await this.assertAreaExists(areaId);
    const entries = await this.prisma.notebookEntry.findMany({
      where: { userId, areaId },
      include: { photos: { orderBy: { position: 'asc' } } },
      orderBy: { date: 'desc' },
    });
    return Promise.all(entries.map((entry) => this.attachSignedUrls(entry)));
  }

  async findOne(userId: string, id: string) {
    const entry = await this.findOwnedEntryOrThrow(userId, id);
    return this.attachSignedUrls(entry);
  }

  async create(userId: string, dto: CreateNotebookEntryDto) {
    await this.assertAreaExists(dto.areaId);

    if (dto.classOccurrenceId) {
      // Mesma lógica de posse do periodId em tasks.service.ts: nunca
      // aceitar um ID só porque o formato é válido, confirmar sempre que
      // pertence a este user antes de ligar a FK.
      const occurrence = await this.prisma.classOccurrence.findFirst({
        where: { id: dto.classOccurrenceId, userId },
      });
      if (!occurrence) {
        throw new BadRequestException(
          'That class occurrence does not belong to you.',
        );
      }
    }

    const entry = await this.prisma.notebookEntry.create({
      data: {
        userId,
        areaId: dto.areaId,
        classOccurrenceId: dto.classOccurrenceId,
        title: dto.title,
        entryType: dto.entryType,
        classNumber: dto.classNumber,
        textContent: dto.textContent,
        drawingStrokes: dto.drawingStrokes,
        tables: dto.tables,
        canvasShapes: dto.canvasShapes,
        canvasLinks: dto.canvasLinks,
        canvasTexts: dto.canvasTexts,
        date: new Date(dto.date),
      } as Prisma.NotebookEntryCreateArgs['data'],
      include: { photos: true },
    });
    return this.attachSignedUrls(entry);
  }

  async update(userId: string, id: string, dto: UpdateNotebookEntryDto) {
    await this.findOwnedEntryOrThrow(userId, id);

    const entry = await this.prisma.notebookEntry.update({
      where: { id },
      data: {
        title: dto.title,
        entryType: dto.entryType,
        classNumber: dto.classNumber,
        textContent: dto.textContent,
        drawingStrokes: dto.drawingStrokes,
        tables: dto.tables,
        canvasShapes: dto.canvasShapes,
        canvasLinks: dto.canvasLinks,
        canvasTexts: dto.canvasTexts,
        date: dto.date ? new Date(dto.date) : undefined,
      } as Prisma.NotebookEntryUpdateArgs['data'],
      include: { photos: { orderBy: { position: 'asc' } } },
    });
    return this.attachSignedUrls(entry);
  }

  async remove(userId: string, id: string) {
    const entry = await this.findOwnedEntryOrThrow(userId, id);

    // Best-effort: limpar os ficheiros no bucket antes de apagar a linha.
    // Se o Storage falhar, não bloqueia o apagar da entrada (mesmo
    // raciocínio do deleteAvatarFileIfOwned em auth.service.ts) - preferimos
    // um ficheiro órfão no bucket a uma entrada que o user não consegue apagar.
    if (entry.photos.length > 0) {
      const paths = entry.photos.map((p) => p.storagePath);
      this.storage.storage
        .from(NOTEBOOK_BUCKET)
        .remove(paths)
        .catch((err) =>
          this.logger.warn(
            `Could not delete notebook photos from storage: ${err}`,
          ),
        );
    }

    await this.prisma.notebookEntry.delete({ where: { id } });
    return { deleted: true };
  }

  async addPhoto(userId: string, entryId: string, file: Express.Multer.File) {
    const entry = await this.findOwnedEntryOrThrow(userId, entryId);

    // Nunca confiar no mimetype declarado pelo cliente - deteta o tipo
    // real pelos magic bytes, mesmo padrão do uploadAvatar em
    // auth.service.ts.
    const detected = await fileTypeFromBuffer(file.buffer);
    const ext = detected ? ALLOWED_MIME_TO_EXT[detected.mime] : undefined;
    if (!ext || !detected) {
      throw new BadRequestException(
        'Unsupported image format. Use PNG, JPG or WEBP.',
      );
    }

    const path = `${userId}/${entryId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await this.storage.storage
      .from(NOTEBOOK_BUCKET)
      .upload(path, file.buffer, { contentType: detected.mime, upsert: false });

    if (uploadError) {
      this.logger.error(
        'Error uploading notebook photo to Supabase',
        uploadError,
      );
      throw new BadRequestException(
        'Could not upload the photo. Please try again.',
      );
    }

    const nextPosition = entry.photos.length;
    const photo = await this.prisma.notebookPhoto.create({
      data: {
        notebookEntryId: entryId,
        storagePath: path,
        position: nextPosition,
      },
    });

    const { data: signedUrlData, error: signError } = await this.storage.storage
      .from(NOTEBOOK_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      this.logger.warn(
        `Could not sign URL for new notebook photo: ${signError.message}`,
      );
    }

    return { ...photo, url: signedUrlData?.signedUrl ?? null };
  }

  async removePhoto(userId: string, entryId: string, photoId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);

    const photo = await this.prisma.notebookPhoto.findFirst({
      where: { id: photoId, notebookEntryId: entryId },
    });
    if (!photo) throw new NotFoundException('Photo not found.');

    const { error } = await this.storage.storage
      .from(NOTEBOOK_BUCKET)
      .remove([photo.storagePath]);
    if (error) {
      this.logger.error('Error deleting notebook photo from Supabase', error);
      throw new BadRequestException(
        'Could not delete the photo. Please try again.',
      );
    }

    await this.prisma.notebookPhoto.delete({ where: { id: photoId } });
    return { deleted: true };
  }

  // --- AreaScheduleLink -----------------------------------------------

  async findScheduleLink(userId: string, areaId: string) {
    const link = await this.prisma.areaScheduleLink.findFirst({
      where: { userId, areaId },
    });
    // NUNCA devolver um `null` nu daqui - um controller a devolver null
    // deixa a serialização da resposta dependente de como o
    // Nest/Express trata esse caso específico (viu-se isto a sair sem
    // Content-Type certo nalguns clientes). Um objeto, mesmo vazio por
    // dentro, serializa sempre da mesma forma.
    return { scheduleSubject: link?.scheduleSubject ?? null };
  }

  async upsertScheduleLink(userId: string, dto: UpsertScheduleLinkDto) {
    await this.assertAreaExists(dto.areaId);

    const existingForSubject = await this.prisma.areaScheduleLink.findUnique({
      where: {
        userId_scheduleSubject: {
          userId,
          scheduleSubject: dto.scheduleSubject,
        },
      },
    });
    if (existingForSubject && existingForSubject.areaId !== dto.areaId) {
      throw new ConflictException(
        `"${dto.scheduleSubject}" is already linked to a different area.`,
      );
    }

    const existingForArea = await this.prisma.areaScheduleLink.findFirst({
      where: { userId, areaId: dto.areaId },
    });

    if (existingForArea) {
      return this.prisma.areaScheduleLink.update({
        where: { id: existingForArea.id },
        data: { scheduleSubject: dto.scheduleSubject },
      });
    }

    return this.prisma.areaScheduleLink.create({
      data: {
        userId,
        areaId: dto.areaId,
        scheduleSubject: dto.scheduleSubject,
      },
    });
  }

  async removeScheduleLink(userId: string, areaId: string) {
    const existing = await this.prisma.areaScheduleLink.findFirst({
      where: { userId, areaId },
    });
    if (!existing)
      throw new NotFoundException('No schedule link for this area.');

    await this.prisma.areaScheduleLink.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  // --- Deteção de aula ---------------------------------------------------

  /**
   * Devolve a ClassOccurrence de hoje desta Area (via AreaScheduleLink)
   * cuja janela [startMinutes, endMinutes] cobre a hora atual (com
   * margem). O número da aula (classNumber) NÃO é sugerido aqui - o
   * frontend calcula-o a partir das entradas já carregadas dessa Area
   * (maior classNumber existente + 1), porque só ele sabe quais já
   * existem sem outra ida à BD, e porque o número tem de poder ser
   * repetido de propósito quando uma aula física deu para duas cadeiras
   * diferentes (ver pedido original do utilizador).
   */
  async detectClassNow(userId: string, areaId: string) {
    const { scheduleSubject } = await this.findScheduleLink(userId, areaId);
    if (!scheduleSubject) return { occurrence: null };

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const todaysOccurrences = await this.prisma.classOccurrence.findMany({
      where: {
        userId,
        subject: scheduleSubject,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const match = todaysOccurrences.find(
      (occ) =>
        nowMinutes >= occ.startMinutes - CLASS_MATCH_MARGIN_MINUTES &&
        nowMinutes <= occ.endMinutes + CLASS_MATCH_MARGIN_MINUTES,
    );

    return { occurrence: match ?? null };
  }

  // --- Pesquisa -----------------------------------------------------

  /**
   * Pesquisa em texto livre por título, conteúdo, nome da cadeira e data
   * (formatada dd/mm/aaaa) - à escala de um caderno pessoal (algumas
   * centenas de entradas ao longo de vários anos, não milhares), filtrar
   * em JS depois de um único findMany é mais simples e mais correto do
   * que tentar exprimir "contém esta substring na data formatada" em SQL,
   * e continua instantâneo a este volume.
   */
  async search(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const entries = await this.prisma.notebookEntry.findMany({
      where: { userId },
      include: {
        photos: { orderBy: { position: 'asc' } },
        area: { select: { id: true, name: true, colorHex: true } },
      },
      orderBy: { date: 'desc' },
    });

    const matches = entries.filter((entry) => {
      const dateLabel = entry.date.toLocaleDateString('pt-PT');
      return (
        entry.title.toLowerCase().includes(q) ||
        (entry.textContent ?? '').toLowerCase().includes(q) ||
        entry.area.name.toLowerCase().includes(q) ||
        dateLabel.includes(q)
      );
    });

    return Promise.all(
      matches.slice(0, 50).map((entry) => this.attachSignedUrls(entry)),
    );
  }
}
