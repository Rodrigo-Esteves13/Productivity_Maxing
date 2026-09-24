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

// Bucket à parte do das fotos - ficheiros gerais (documentos, código),
// não imagens para mostrar inline. Também nunca público; o acesso é
// sempre via signed URL, e sempre com download forçado (ver
// addAttachment/attachSignedUrls) para nunca ser aberto inline no
// browser.
const ATTACHMENT_BUCKET =
  process.env.SUPABASE_NOTEBOOK_ATTACHMENTS_BUCKET ?? 'notebook-attachments';

// Formatos com magic bytes reais - detetados pelo conteúdo do ficheiro,
// nunca pela extensão que o cliente diz que é (mesmo critério das
// fotos). DOCX/PPTX/XLSX são na prática ficheiros ZIP com uma estrutura
// interna própria; a `file-type` já sabe distinguir isso do ZIP genérico.
const ATTACHMENT_BINARY_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Formatos de texto puro - não têm magic bytes nenhuns para detetar (é
// só texto), por isso a validação aqui é diferente: sem bytes binários +
// extensão pedida nesta lista + limite de tamanho (ver
// ATTACHMENT_MAX_SIZE_BYTES). Nunca são executados em lado nenhum do
// servidor, só guardados e devolvidos como download.
const ATTACHMENT_TEXT_EXTENSIONS = new Set(['py', 'txt', 'md', 'json', 'csv']);

export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_MAX_PER_ENTRY = 10;

// Só para o nome mostrado/descarregado depois - tira barras e
// caracteres de controlo/aspas (evita confundir o cabeçalho
// Content-Disposition do download). O caminho real no bucket nunca usa
// este valor, é sempre um UUID gerado no servidor (ver `path` em
// addAttachment), por isso isto não é uma defesa contra path traversal,
// é só higiene do nome mostrado.
function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[\\/]/g, '_')
      // eslint-disable-next-line no-control-regex -- remover caracteres de controlo é o próprio objetivo desta regex, não uma apanhada sem querer.
      .replace(/[\x00-\x1F\x7F"]/g, '')
      .trim()
  );
}

// Heurística "isto parece texto ou binário": um NUL byte não aparece em
// texto normal UTF-8/Latin1, é o sinal clássico de conteúdo binário
// (o mesmo que o git usa para a mesma decisão). Não é uma prova formal,
// mas combinada com a extensão pedida e o ficheiro nunca ser executado
// em lado nenhum, é uma barreira razoável para o que resta depois da
// deteção por magic bytes.
function looksLikeBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

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
      include: {
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!entry)
      throw new NotFoundException(
        `Notebook entry not found or you don't have access.`,
      );
    return entry;
  }

  // Troca cada storagePath por um signed URL fresco - nunca persistimos o
  // URL em si (expira), só o caminho no bucket. Anexos (ao contrário de
  // fotos) pedem sempre `download` no signed URL - força
  // Content-Disposition: attachment, nunca abre inline no browser.
  private async attachSignedUrls<
    T extends {
      photos: { id: string; storagePath: string }[];
      attachments: {
        id: string;
        storagePath: string;
        originalFileName: string;
      }[];
    },
  >(
    entry: T,
  ): Promise<
    T & {
      photos: (T['photos'][number] & { url: string | null })[];
      attachments: (T['attachments'][number] & { url: string | null })[];
    }
  > {
    const [photosWithUrls, attachmentsWithUrls] = await Promise.all([
      Promise.all(
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
      ),
      Promise.all(
        entry.attachments.map(async (attachment) => {
          const { data, error } = await this.storage.storage
            .from(ATTACHMENT_BUCKET)
            .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS, {
              download: attachment.originalFileName,
            });
          if (error) {
            this.logger.warn(
              `Could not sign URL for notebook attachment ${attachment.id}: ${error.message}`,
            );
          }
          return { ...attachment, url: data?.signedUrl ?? null };
        }),
      ),
    ]);
    return {
      ...entry,
      photos: photosWithUrls,
      attachments: attachmentsWithUrls,
    };
  }

  async findAllForArea(userId: string, areaId: string) {
    await this.assertAreaExists(areaId);
    const entries = await this.prisma.notebookEntry.findMany({
      where: { userId, areaId },
      include: {
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
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
        usefulLinks: dto.usefulLinks,
        canvasHeight: dto.canvasHeight,
        date: new Date(dto.date),
      } as Prisma.NotebookEntryCreateArgs['data'],
      include: { photos: true, attachments: true },
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
        usefulLinks: dto.usefulLinks,
        canvasHeight: dto.canvasHeight,
        date: dto.date ? new Date(dto.date) : undefined,
      } as Prisma.NotebookEntryUpdateArgs['data'],
      include: {
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
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

    if (entry.attachments.length > 0) {
      const paths = entry.attachments.map((a) => a.storagePath);
      this.storage.storage
        .from(ATTACHMENT_BUCKET)
        .remove(paths)
        .catch((err) =>
          this.logger.warn(
            `Could not delete notebook attachments from storage: ${err}`,
          ),
        );
    }

    await this.prisma.notebookEntry.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Partilha (link "só de leitura" para amigos, sem precisarem de
  // conta) --------------------------------------------------------------
  // Uma linha por entrada (@unique em notebookEntryId no schema) - "criar
  // partilha" é upsert (idempotente: se já existe, devolve a existente em
  // vez de gerar um segundo token e invalidar o anterior sem avisar quem
  // já tem o link antigo). "Parar de partilhar" apaga a linha - sem soft
  // revoke, o token deixa de ser válido de imediato.

  async getShareStatus(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
    });
    return { shared: !!share, token: share?.token ?? null };
  }

  async createShare(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.upsert({
      where: { notebookEntryId: entryId },
      create: { notebookEntryId: entryId, createdByUserId: userId },
      update: {},
    });
    return { shared: true, token: share.token };
  }

  async revokeShare(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    // deleteMany (não delete) porque não há garantia de que exista uma
    // partilha ativa - "parar de partilhar" quando já não há nada para
    // parar não deve dar 404, é um estado final igualmente válido.
    await this.prisma.notebookShare.deleteMany({
      where: { notebookEntryId: entryId },
    });
    return { shared: false, token: null };
  }

  // Público - SEM JwtAuthGuard (ver NotebookShareController). O token
  // UUID é a única credencial; não confirma nem infirma se `token` "quase
  // corresponde" a nada (findUnique simples, 404 genérico), e nunca
  // devolve userId/areaId/classOccurrenceId internos - só o que uma
  // pessoa de fora precisa para ver a lesson.
  async getSharedEntry(token: string) {
    const share = await this.prisma.notebookShare.findUnique({
      where: { token },
      include: {
        notebookEntry: {
          include: {
            area: { select: { name: true, colorHex: true } },
            photos: { orderBy: { position: 'asc' } },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!share)
      throw new NotFoundException('This share link is invalid or was removed.');

    const { notebookEntry: entry } = share;
    const withUrls = await this.attachSignedUrls(entry);
    return {
      title: withUrls.title,
      entryType: withUrls.entryType,
      classNumber: withUrls.classNumber,
      textContent: withUrls.textContent,
      drawingStrokes: withUrls.drawingStrokes,
      tables: withUrls.tables,
      canvasShapes: withUrls.canvasShapes,
      canvasLinks: withUrls.canvasLinks,
      canvasTexts: withUrls.canvasTexts,
      canvasHeight: withUrls.canvasHeight,
      usefulLinks: withUrls.usefulLinks,
      date: withUrls.date,
      area: entry.area,
      photos: withUrls.photos,
      attachments: withUrls.attachments,
    };
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

  async addAttachment(
    userId: string,
    entryId: string,
    file: Express.Multer.File,
  ) {
    const entry = await this.findOwnedEntryOrThrow(userId, entryId);

    if (entry.attachments.length >= ATTACHMENT_MAX_PER_ENTRY) {
      throw new BadRequestException(
        `Each entry can have at most ${ATTACHMENT_MAX_PER_ENTRY} files attached.`,
      );
    }

    // Nome tal como o cliente mandou, só para mostrar/descarregar depois -
    // nunca usado para o caminho no storage (isso é sempre um UUID, ver
    // `path` abaixo). Cortado a 200 chars para nunca deixar um
    // Content-Disposition com um nome descontrolado.
    const originalFileName =
      sanitizeFileName(file.originalname || 'file').slice(0, 200) || 'file';
    const claimedExt = originalFileName.includes('.')
      ? originalFileName.split('.').pop()!.toLowerCase()
      : '';

    // Nunca confiar na extensão nem no mimetype declarados pelo cliente -
    // para os formatos com magic bytes reais (PDF/DOCX/PPTX/XLSX/ZIP), o
    // tipo detetado é que manda, mesmo que a extensão pedida diga outra
    // coisa. Para texto puro (sem magic bytes), só aceite se a extensão
    // pedida estiver na lista permitida E o conteúdo não parecer binário.
    const detected = await fileTypeFromBuffer(file.buffer);
    let ext: string | undefined;
    if (detected) {
      ext = ATTACHMENT_BINARY_MIME_TO_EXT[detected.mime];
    } else if (
      ATTACHMENT_TEXT_EXTENSIONS.has(claimedExt) &&
      !looksLikeBinary(file.buffer)
    ) {
      ext = claimedExt;
    }

    if (!ext) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, DOCX, PPTX, XLSX, ZIP, PY, TXT, MD, JSON, CSV.',
      );
    }

    const path = `${userId}/${entryId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await this.storage.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file.buffer, {
        contentType: detected?.mime ?? 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(
        'Error uploading notebook attachment to Supabase',
        uploadError,
      );
      throw new BadRequestException(
        'Could not upload the file. Please try again.',
      );
    }

    const attachment = await this.prisma.notebookAttachment.create({
      data: {
        notebookEntryId: entryId,
        storagePath: path,
        originalFileName,
        extension: ext,
        sizeBytes: file.size,
      },
    });

    const { data: signedUrlData, error: signError } = await this.storage.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
        download: originalFileName,
      });
    if (signError) {
      this.logger.warn(
        `Could not sign URL for new notebook attachment: ${signError.message}`,
      );
    }

    return { ...attachment, url: signedUrlData?.signedUrl ?? null };
  }

  async removeAttachment(
    userId: string,
    entryId: string,
    attachmentId: string,
  ) {
    await this.findOwnedEntryOrThrow(userId, entryId);

    const attachment = await this.prisma.notebookAttachment.findFirst({
      where: { id: attachmentId, notebookEntryId: entryId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    const { error } = await this.storage.storage
      .from(ATTACHMENT_BUCKET)
      .remove([attachment.storagePath]);
    if (error) {
      this.logger.error(
        'Error deleting notebook attachment from Supabase',
        error,
      );
      throw new BadRequestException(
        'Could not delete the file. Please try again.',
      );
    }

    await this.prisma.notebookAttachment.delete({
      where: { id: attachmentId },
    });
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
        attachments: { orderBy: { createdAt: 'asc' } },
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
