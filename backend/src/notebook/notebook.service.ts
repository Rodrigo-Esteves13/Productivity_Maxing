import {
  accessibleAreaWhere,
  assertAreaAccessible,
} from '../areas/area-access';
import { getLisbonNow } from '../common/date-key.util';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { NotebookEntryType, Prisma } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';
import { PushService } from '../push/push.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveShareAccess } from './share-role.util';
import {
  validateAttachmentUpload,
  withDownloadName,
} from './attachment-validation.util';
import { areFriends } from '../social/friendship.util';
import {
  CreateNotebookEntryDto,
  UpdateNotebookEntryDto,
} from './dto/upsert-notebook-entry.dto';
import { UpsertScheduleLinkDto } from './dto/upsert-schedule-link.dto';
import { notebookEntrySharePath } from '../common/app-links.util';
import {
  getNotebookAttachmentsBucket,
  getNotebookBucket,
} from '../config/app.config';

// Bucket dedicado, separado do de avatars, e NUNCA público - são
// apontamentos e fotos pessoais de aulas, não fotos de perfil. Tem de
// existir no projeto Supabase com "Public bucket" DESLIGADO; o acesso é
// sempre via signed URL de curta duração (ver attachSignedUrls).
const NOTEBOOK_BUCKET = getNotebookBucket();

// Tempo de vida do signed URL devolvido ao frontend - só precisa de
// sobreviver ao carregamento da página de uma entrada, nunca fica
// guardado em lado nenhum (nem na BD, nem no frontend entre navegações).
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Caracteres de textContent no resumo da lista (ver listSummariesForArea).
// O frontend tira o markdown e mostra no maximo ~220, por isso sobra margem.
const SUMMARY_PREVIEW_CHARS = 400;

export interface NotebookEntrySummary {
  id: string;
  areaId: string;
  title: string;
  entryType: NotebookEntryType;
  classNumber: number | null;
  date: Date;
  preview: string | null;
  photoCount: number;
  attachmentCount: number;
}

// Caminhos por pedido de createSignedUrls (ver signPaths). Um caderno normal
// cabe todo num so pedido; o limite so evita um corpo gigante.
const SIGN_BATCH_SIZE = 500;

interface SignableEntry {
  photos: { id: string; storagePath: string }[];
  attachments: {
    id: string;
    storagePath: string;
    originalFileName: string;
  }[];
}

// Omit: com `T & {...}` o tipo de `photos` ficava a interseção de dois
// arrays e `.map` via o elemento sem `url`.
type WithSignedUrls<T extends SignableEntry> = Omit<
  T,
  'photos' | 'attachments'
> & {
  photos: (T['photos'][number] & { url: string | null })[];
  attachments: (T['attachments'][number] & { url: string | null })[];
};

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
const ATTACHMENT_BUCKET = getNotebookAttachmentsBucket();

const ATTACHMENT_MAX_PER_ENTRY = 10;

// Margem à volta do início/fim da aula em que ainda consideramos "aula
// agora" para efeitos de sugestão automática - chegar 10 min atrasado ou
// ainda estar a arrumar 10 min depois de acabar não deve fazer a
// sugestão desaparecer.
const CLASS_MATCH_MARGIN_MINUTES = 15;

// Normaliza para comparar nomes: sem acentos, minusculas, sem pontuacao.
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Comunicacao de Dados e Redes III" casa com "Comunicação de Dados e Redes III - TP". */
function matchesAreaName(subject: string, areaName: string): boolean {
  const a = normalizeName(subject);
  const b = normalizeName(areaName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Uma pessoa a abrir /shared/:token pode estar em 5 estados diferentes -
// ver NotebookService.getSharedEntry. O controller devolve isto tal e
// qual (200 OK sempre que o token existe); só um token inexistente ou
// removido continua a dar 404 (ver NotebookShareController), porque
// isso é um erro genuíno de "este link não existe", não um dos estados
// normais de uma partilha AUTHORIZED.
export type SharedEntryResult =
  | {
      status: 'ok';
      entry: Record<string, unknown>;
      // Papel de quem abre: so o OWNER/CO_OWNER edita direto, o EDITOR
      // propoe alteracoes (ver NotebookCollabService).
      role: 'OWNER' | 'CO_OWNER' | 'EDITOR' | 'VIEWER';
      hasPendingProposal: boolean;
      context: SharedEntryContext;
    }
  | { status: 'login_required' }
  | { status: 'not_requested' }
  | { status: 'pending' }
  | { status: 'invited'; requestId: string }
  | { status: 'denied' };

/**
 * Para navegar a partir de uma nota partilhada: o dono ve o id da nota (para
 * "Abrir no caderno"); um AMIGO do dono ve quem partilhou (para ir a pagina
 * desse amigo). Quem nao e amigo nao fica a saber quem e o dono por aqui.
 */
export interface SharedEntryContext {
  ownEntryId: string | null;
  owner: {
    userId: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name);
  private readonly storage: ReturnType<typeof createClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {
    this.storage = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  // Area oficial OU privada deste user (ver areas/area-access.ts).
  private assertAreaExists(userId: string, areaId: string): Promise<void> {
    return assertAreaAccessible(this.prisma, userId, areaId);
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

  // Assina varios ficheiros de um bucket com createSignedUrls: um pedido ao
  // Storage por lote, nunca um por ficheiro. Antes, abrir um caderno com 40
  // entradas e 3 fotos cada eram 120 pedidos HTTP ao Supabase. Devolve
  // storagePath -> URL (sem entrada no mapa = o Storage nao assinou).
  private async signPaths(
    bucket: string,
    paths: string[],
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    const unique = [...new Set(paths)];
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += SIGN_BATCH_SIZE) {
      chunks.push(unique.slice(i, i + SIGN_BATCH_SIZE));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await this.storage.storage
          .from(bucket)
          .createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);
        if (error) {
          this.logger.warn(
            `Could not sign ${chunk.length} URLs in bucket ${bucket}: ${error.message}`,
          );
          return;
        }
        data.forEach((item, index) => {
          const path = item.path ?? chunk[index];
          if (item.signedUrl && path) urls.set(path, item.signedUrl);
        });
      }),
    );
    return urls;
  }

  // Troca cada storagePath por um signed URL fresco - nunca persistimos o
  // URL em si (expira), só o caminho no bucket. Anexos (ao contrário de
  // fotos) pedem sempre `download` no signed URL - força
  // Content-Disposition: attachment, nunca abre inline no browser.
  // Recebe varias entradas de uma vez: no maximo um pedido por bucket.
  private async attachSignedUrlsMany<T extends SignableEntry>(
    entries: T[],
  ): Promise<WithSignedUrls<T>[]> {
    const [photoUrls, attachmentUrls] = await Promise.all([
      this.signPaths(
        NOTEBOOK_BUCKET,
        entries.flatMap((entry) => entry.photos.map((p) => p.storagePath)),
      ),
      this.signPaths(
        ATTACHMENT_BUCKET,
        entries.flatMap((entry) => entry.attachments.map((a) => a.storagePath)),
      ),
    ]);
    return entries.map((entry) => ({
      ...entry,
      photos: entry.photos.map((photo) => {
        const url = photoUrls.get(photo.storagePath) ?? null;
        if (!url) {
          this.logger.warn(`Could not sign URL for notebook photo ${photo.id}`);
        }
        return { ...photo, url };
      }),
      attachments: entry.attachments.map((attachment) => {
        const url = attachmentUrls.get(attachment.storagePath) ?? null;
        if (!url) {
          this.logger.warn(
            `Could not sign URL for notebook attachment ${attachment.id}`,
          );
        }
        return {
          ...attachment,
          url: url && withDownloadName(url, attachment.originalFileName),
        };
      }),
    }));
  }

  private async attachSignedUrls<T extends SignableEntry>(
    entry: T,
  ): Promise<WithSignedUrls<T>> {
    const [signed] = await this.attachSignedUrlsMany([entry]);
    return signed;
  }

  async findAllForArea(userId: string, areaId: string) {
    await this.assertAreaExists(userId, areaId);
    const entries = await this.prisma.notebookEntry.findMany({
      where: { userId, areaId },
      include: {
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { date: 'desc' },
    });
    return this.attachSignedUrlsMany(entries);
  }

  /**
   * A lista da cadeira no Notebook: so o que a lista e o resumo mostram.
   * findAllForArea mandava o conteudo inteiro de todas as entradas
   * (desenhos, tabelas e canvas em JSON, ~80 KB numa aula desenhada) e
   * assinava todas as fotos, para o ecra so usar titulo, data, o inicio do
   * texto e quantas fotos/ficheiros ha. A entrada completa vem a pedido de
   * GET /notebook/entries/:id quando e aberta. findAllForArea fica igual
   * para um separador aberto com o frontend antigo continuar a gravar com
   * o conteudo completo.
   */
  async listSummariesForArea(
    userId: string,
    areaId: string,
  ): Promise<NotebookEntrySummary[]> {
    await this.assertAreaExists(userId, areaId);
    const rows = await this.prisma.notebookEntry.findMany({
      where: { userId, areaId },
      select: {
        id: true,
        areaId: true,
        title: true,
        entryType: true,
        classNumber: true,
        date: true,
        textContent: true,
        _count: { select: { photos: true, attachments: true } },
      },
      orderBy: { date: 'desc' },
    });
    return rows.map(({ textContent, _count, ...rest }) => ({
      ...rest,
      preview: textContent ? textContent.slice(0, SUMMARY_PREVIEW_CHARS) : null,
      photoCount: _count.photos,
      attachmentCount: _count.attachments,
    }));
  }

  async findOne(userId: string, id: string) {
    const entry = await this.findOwnedEntryOrThrow(userId, id);
    return this.attachSignedUrls(entry);
  }

  async create(userId: string, dto: CreateNotebookEntryDto) {
    await this.assertAreaExists(userId, dto.areaId);

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

    // Privacidade inicial para amigos segue a preferencia do utilizador.
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notesPrivateByDefault: true },
    });

    const entry = await this.prisma.notebookEntry.create({
      data: {
        userId,
        privateFromFriends: owner?.notesPrivateByDefault ?? false,
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
    if (dto.classOccurrenceId) {
      // Apontamento escrito nessa aula = estive lá. Só preenche presenças
      // ainda por marcar: uma falta marcada à mão nunca é sobreposta.
      await this.prisma.classOccurrence.updateMany({
        where: { id: dto.classOccurrenceId, userId, attended: null },
        data: { attended: true },
      });
    }
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
        privateFromFriends: dto.privateFromFriends,
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

  // --- Partilha (link para amigos, sem precisarem de conta - ou, em modo
  // AUTHORIZED, com conta E aprovação do dono) ----------------------------
  // Uma linha por entrada (@unique em notebookEntryId no schema) - "criar
  // partilha" é upsert (idempotente: se já existe, devolve a existente em
  // vez de gerar um segundo token e invalidar o anterior sem avisar quem
  // já tem o link antigo). "Parar de partilhar" apaga a linha - sem soft
  // revoke, o token deixa de ser válido de imediato, e cascade apaga
  // também qualquer NotebookShareAccessRequest pendente.

  async getShareStatus(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
    });
    return {
      shared: !!share,
      token: share?.token ?? null,
      visibility: share?.visibility ?? 'PUBLIC',
    };
  }

  async createShare(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.upsert({
      where: { notebookEntryId: entryId },
      create: { notebookEntryId: entryId, createdByUserId: userId },
      update: {},
    });
    return { shared: true, token: share.token, visibility: share.visibility };
  }

  async revokeShare(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    // deleteMany (não delete) porque não há garantia de que exista uma
    // partilha ativa - "parar de partilhar" quando já não há nada para
    // parar não deve dar 404, é um estado final igualmente válido.
    await this.prisma.notebookShare.deleteMany({
      where: { notebookEntryId: entryId },
    });
    return { shared: false, token: null, visibility: 'PUBLIC' as const };
  }

  // Troca PUBLIC <-> AUTHORIZED sem tocar no token - quem já tinha o link
  // guardado continua a usar o mesmo, só passa a precisar de sessão +
  // aprovação a partir de agora (ou deixa de precisar, se voltar a
  // PUBLIC). À parte de createShare de propósito: criar a partilha e
  // mudar o seu modo são ações distintas, e não faz sentido
  // "createShare({visibility: AUTHORIZED})" reaproveitar o upsert de
  // create acima e arriscar sobrescrever silenciosamente uma partilha já
  // existente que o dono só queria voltar a ler o token de.
  async updateShareVisibility(
    userId: string,
    entryId: string,
    visibility: 'PUBLIC' | 'AUTHORIZED',
  ) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
    });
    if (!share) {
      throw new NotFoundException(
        'Create a share link before changing who can access it.',
      );
    }
    const updated = await this.prisma.notebookShare.update({
      where: { notebookEntryId: entryId },
      data: { visibility },
    });
    return {
      shared: true,
      token: updated.token,
      visibility: updated.visibility,
    };
  }

  // Chamado pela pessoa DE FORA a pedir acesso a uma partilha AUTHORIZED -
  // precisa de sessão (ver NotebookShareController), mas nunca precisa de
  // ser dona da entry (isso é bloqueado abaixo: o dono já vê tudo, pedir
  // acesso à própria partilha não faz sentido). Upsert em vez de create
  // simples: pedir de novo depois de um DENIED volta a PENDING (dá à
  // pessoa uma segunda oportunidade sem o dono ter de apagar nada à mão);
  // pedir de novo estando já PENDING ou APPROVED é idempotente, devolve o
  // estado atual sem o alterar.
  async requestAccess(requestingUserId: string, token: string) {
    const share = await this.prisma.notebookShare.findUnique({
      where: { token },
    });
    if (!share) {
      throw new NotFoundException('This share link is invalid or was removed.');
    }
    if (share.visibility !== 'AUTHORIZED') {
      throw new BadRequestException(
        'This share does not require requesting access.',
      );
    }
    if (share.createdByUserId === requestingUserId) {
      throw new BadRequestException('You already own this shared lesson.');
    }

    const existing = await this.prisma.notebookShareAccessRequest.findUnique({
      where: {
        notebookShareId_requestingUserId: {
          notebookShareId: share.id,
          requestingUserId,
        },
      },
    });
    if (existing && existing.status !== 'DENIED') {
      return { status: existing.status };
    }

    const request = await this.prisma.notebookShareAccessRequest.upsert({
      where: {
        notebookShareId_requestingUserId: {
          notebookShareId: share.id,
          requestingUserId,
        },
      },
      create: {
        notebookShareId: share.id,
        requestingUserId,
        status: 'PENDING',
      },
      update: { status: 'PENDING', decidedAt: null },
    });

    // Avisa o dono (push) de que há um pedido novo - só aqui, não nos
    // pedidos repetidos já PENDING (devolvem acima, sem spam).
    const [requester, entry] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { name: true, email: true },
      }),
      this.prisma.notebookEntry.findUnique({
        where: { id: share.notebookEntryId },
        select: { title: true },
      }),
    ]);
    // No maximo um aviso por pedinte e por dia (recusado e refeito, etc.).
    void this.push.notifyUserOnce(
      share.createdByUserId,
      'shareAccessRequested',
      {
        name: requester?.name ?? requester?.email?.split('@')[0] ?? '',
        title: entry?.title ?? '',
        url: notebookEntrySharePath(share.notebookEntryId),
      },
      `shareAccessRequested:${share.id}:${requestingUserId}`,
    );
    return { status: request.status };
  }

  // Lado do dono: a lista de quem pediu acesso a esta entry, para o
  // painel de aprovação em NotebookEntryShare.tsx. findOwnedEntryOrThrow
  // é a verificação de posse - sem partilha nenhuma ainda, devolve uma
  // lista vazia em vez de 404 (pedir a lista antes de a entry alguma vez
  // ter sido partilhada não é um erro, é só "nada para mostrar ainda").
  async listAccessRequests(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
    });
    if (!share) return [];

    const rows = await this.prisma.notebookShareAccessRequest.findMany({
      where: { notebookShareId: share.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        accessRole: true,
        invitedByOwner: true,
        createdAt: true,
        decidedAt: true,
        requestingUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
    // Amigos convidados: so o nome (o email de amigos nunca sai da pessoa).
    return rows.map((row) =>
      row.invitedByOwner
        ? { ...row, requestingUser: { ...row.requestingUser, email: '' } }
        : row,
    );
  }

  // Lado do dono: aprova ou nega um pedido específico. requestId E entryId
  // são ambos verificados juntos (o where abaixo cruza
  // notebookShare.notebookEntryId com o entryId já confirmado como do
  // dono) - defesa contra IDOR: um requestId de OUTRA entry (de outro
  // dono qualquer) nunca é encontrado através deste caminho, mesmo que
  // alguém adivinhe o UUID.
  async decideAccessRequest(
    userId: string,
    entryId: string,
    requestId: string,
    decision: 'APPROVED' | 'DENIED',
    role?: 'VIEWER' | 'EDITOR' | 'CO_OWNER',
  ) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const request = await this.prisma.notebookShareAccessRequest.findFirst({
      where: { id: requestId, notebookShare: { notebookEntryId: entryId } },
    });
    if (!request) {
      throw new NotFoundException('Access request not found.');
    }
    // Um convite pendente so quem foi convidado o aceita; o dono pode
    // cancelar (DELETE .../access/:requestId), nunca aceitar por ele.
    if (request.invitedByOwner && request.status === 'PENDING') {
      throw new ConflictException(
        'This is an invitation waiting for the invited person to accept.',
      );
    }

    const updated = await this.prisma.notebookShareAccessRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedAt: new Date(),
        // Sem `role` mantem o papel atual (por omissao VIEWER); negar nunca
        // muda o papel.
        ...(decision === 'APPROVED' && role ? { accessRole: role } : {}),
      },
    });

    // Avisa quem pediu (push) da resposta, com link direto para a lição.
    const shareInfo = await this.prisma.notebookShare.findUnique({
      where: { id: request.notebookShareId },
      select: { token: true, notebookEntry: { select: { title: true } } },
    });
    if (shareInfo) {
      void this.push.notifyUser(
        request.requestingUserId,
        decision === 'APPROVED' ? 'shareAccessApproved' : 'shareAccessDenied',
        {
          title: shareInfo.notebookEntry.title,
          url: `/shared/${shareInfo.token}`,
        },
      );
    }
    return {
      id: updated.id,
      status: updated.status,
      accessRole: updated.accessRole,
    };
  }

  // --- Telemetria de visitas ao link ---------------------------------------
  // Uma linha por visitante. Conta uma "visita" nova só se a última foi há
  // mais de 30 min (recarregar a página não infla o número). As visitas do
  // próprio dono não contam. Visitantes sem conta: HMAC do IP+user-agent com
  // um segredo do servidor - nunca se guarda o IP.
  private static readonly VISIT_WINDOW_MS = 30 * 60 * 1000;

  private visitorKey(
    userId: string | null,
    meta: { ip?: string; userAgent?: string } | null,
  ): string | null {
    if (userId) return `u:${userId}`;
    const base = process.env.JWT_SECRET;
    if (!base || !meta?.ip) return null;
    // Chave DERIVADA (rotulo fixo), nunca o JWT_SECRET em bruto: o mesmo
    // segredo nao serve dois fins (assinar sessoes e anonimizar visitas).
    const secret = createHmac('sha256', base).update('share-visit-v1').digest();
    const hash = createHmac('sha256', secret)
      .update(`${meta.ip}|${meta.userAgent ?? ''}`)
      .digest('hex')
      .slice(0, 32);
    return `a:${hash}`;
  }

  private async recordVisit(
    shareId: string,
    ownerId: string,
    userId: string | null,
    meta: { ip?: string; userAgent?: string } | null,
  ): Promise<void> {
    if (userId === ownerId) return;
    const viewerKey = this.visitorKey(userId, meta);
    if (!viewerKey) return;
    try {
      const now = new Date();
      const existing = await this.prisma.shareVisit.findUnique({
        where: {
          notebookShareId_viewerKey: { notebookShareId: shareId, viewerKey },
        },
      });
      if (!existing) {
        await this.prisma.shareVisit.create({
          data: {
            notebookShareId: shareId,
            viewerKey,
            viewerUserId: userId,
          },
        });
        return;
      }
      const isNewVisit =
        now.getTime() - existing.lastVisitAt.getTime() >
        NotebookService.VISIT_WINDOW_MS;
      await this.prisma.shareVisit.update({
        where: { id: existing.id },
        data: {
          lastVisitAt: now,
          ...(isNewVisit ? { count: { increment: 1 } } : {}),
          // Quem abriu sem sessão e depois fez login passa a ter nome.
          ...(userId && !existing.viewerUserId ? { viewerUserId: userId } : {}),
        },
      });
    } catch (error) {
      // Telemetria nunca pode partir a abertura da lição.
      this.logger.warn(`recordVisit falhou: ${(error as Error).message}`);
    }
  }

  /** Lado do dono: quem abriu o link e quantas vezes. */
  async getShareVisits(userId: string, entryId: string) {
    await this.findOwnedEntryOrThrow(userId, entryId);
    const share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
      select: { id: true },
    });
    if (!share) return { totalVisits: 0, uniqueVisitors: 0, viewers: [] };

    const rows = await this.prisma.shareVisit.findMany({
      where: { notebookShareId: share.id },
      orderBy: { lastVisitAt: 'desc' },
      take: 200,
      select: {
        count: true,
        firstVisitAt: true,
        lastVisitAt: true,
        viewerUser: { select: { name: true, avatarUrl: true } },
      },
    });
    return {
      totalVisits: rows.reduce((sum, r) => sum + r.count, 0),
      uniqueVisitors: rows.length,
      viewers: rows.map((r) => ({
        // null = visitante sem conta (anónimo).
        name: r.viewerUser?.name ?? null,
        avatarUrl: r.viewerUser?.avatarUrl ?? null,
        isAnonymous: !r.viewerUser,
        count: r.count,
        firstVisitAt: r.firstVisitAt,
        lastVisitAt: r.lastVisitAt,
      })),
    };
  }

  // Público - SEM JwtAuthGuard de classe (ver NotebookShareController),
  // mas com OptionalJwtAuthGuard nesta rota específica: `requestingUserId`
  // vem preenchido quando quem pede já tem sessão, e fica null quando não
  // tem - os dois casos são válidos, a diferença é só o que este método
  // decide devolver. O token UUID continua a ser a única credencial que
  // PROVA que se conhece o link; não confirma nem infirma se `token`
  // "quase corresponde" a nada (findUnique simples, 404 genérico).
  async getSharedEntry(
    token: string,
    requestingUserId: string | null,
    visitor: { ip?: string; userAgent?: string } | null = null,
  ): Promise<SharedEntryResult> {
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

    void this.recordVisit(
      share.id,
      share.createdByUserId,
      requestingUserId,
      visitor,
    );

    const access = await resolveShareAccess(
      this.prisma,
      share,
      requestingUserId,
    );
    if (access.state !== 'ok') {
      return access.state === 'invited'
        ? { status: 'invited', requestId: access.requestId }
        : { status: access.state };
    }
    const role = access.role;

    const hasPendingProposal =
      role === 'EDITOR' && requestingUserId
        ? (await this.prisma.notebookChangeProposal.count({
            where: {
              notebookEntryId: share.notebookEntryId,
              proposedByUserId: requestingUserId,
              status: 'PENDING',
            },
          })) > 0
        : false;

    return {
      status: 'ok',
      role,
      hasPendingProposal,
      context: await this.sharedEntryContext(
        share.createdByUserId,
        share.notebookEntryId,
        requestingUserId,
      ),
      entry: await this.buildSharedEntryView(share.notebookEntry),
    };
  }

  private async sharedEntryContext(
    ownerId: string,
    entryId: string,
    viewerId: string | null,
  ): Promise<SharedEntryContext> {
    if (viewerId === ownerId) return { ownEntryId: entryId, owner: null };
    if (!viewerId || !(await areFriends(this.prisma, ownerId, viewerId))) {
      return { ownEntryId: null, owner: null };
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, avatarUrl: true },
    });
    return {
      ownEntryId: null,
      owner: owner
        ? { userId: owner.id, name: owner.name, avatarUrl: owner.avatarUrl }
        : null,
    };
  }

  /**
   * Campos de uma entrada que quem a le por partilha pode ver (nunca ids
   * internos nem o dono). Usado pelos links e pelo acesso entre amigos.
   */
  async buildSharedEntryView(entry: {
    title: string;
    entryType: string;
    classNumber: number | null;
    textContent: string | null;
    drawingStrokes: unknown;
    tables: unknown;
    canvasShapes: unknown;
    canvasLinks: unknown;
    canvasTexts: unknown;
    canvasHeight: number | null;
    usefulLinks: unknown;
    date: Date;
    area: { name: string; colorHex: string | null };
    photos: { id: string; storagePath: string }[];
    attachments: {
      id: string;
      storagePath: string;
      originalFileName: string;
    }[];
  }): Promise<Record<string, unknown>> {
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

    const { originalFileName, ext, content, contentType } =
      await validateAttachmentUpload(file);

    const path = `${userId}/${entryId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await this.storage.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, content, {
        contentType,
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
        sizeBytes: content.length,
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
    await this.assertAreaExists(userId, dto.areaId);

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

    // Hora de Lisboa (o processo corre em UTC): as aulas guardam o dia como
    // meia-noite UTC do dia de calendario de Lisboa.
    const { today, nowMinutes } = getLisbonNow();

    const todaysOccurrences = await this.prisma.classOccurrence.findMany({
      where: {
        userId,
        // Sem ligacao ainda: olha para todas as aulas de hoje e tenta
        // casar pelo nome da cadeira (ver matchesAreaName).
        ...(scheduleSubject ? { subject: scheduleSubject } : {}),
        date: today,
      },
    });

    const isRunningNow = (occ: { startMinutes: number; endMinutes: number }) =>
      nowMinutes >= occ.startMinutes - CLASS_MATCH_MARGIN_MINUTES &&
      nowMinutes <= occ.endMinutes + CLASS_MATCH_MARGIN_MINUTES;

    if (scheduleSubject) {
      return { occurrence: todaysOccurrences.find(isRunningNow) ?? null };
    }

    const area = await this.prisma.area.findFirst({
      where: { id: areaId, ...accessibleAreaWhere(userId) },
      select: { name: true },
    });
    const match = area
      ? todaysOccurrences.find(
          (occ) => isRunningNow(occ) && matchesAreaName(occ.subject, area.name),
        )
      : undefined;
    if (!match) return { occurrence: null };

    // Aula encontrada pelo nome. NAO se grava a ligacao aqui: isto corre num
    // GET (sem CSRF, e o cookie SameSite=Lax segue navegacoes de topo), por
    // isso um GET nunca muda estado. `matchedByName` diz ao frontend para
    // pedir a ligacao por POST (upsertScheduleLink).
    return { occurrence: match, matchedByName: true };
  }

  // --- Pesquisa -----------------------------------------------------

  /**
   * Pesquisa em texto livre por título, conteúdo, nome da cadeira e data
   * (formatada dd/mm/aaaa) - à escala de um caderno pessoal (algumas
   * centenas de entradas ao longo de vários anos, não milhares), filtrar
   * em JS depois de um findMany leve (só os campos comparados) é mais simples e mais correto do
   * que tentar exprimir "contém esta substring na data formatada" em SQL,
   * e continua instantâneo a este volume.
   */
  async search(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // 1.o passo: so os campos que a pesquisa compara. Os desenhos, tabelas
    // e canvas (JSON que pode ser grande) e as fotos/anexos de TODAS as
    // entradas ficavam fora de qualquer uso - e isto corre a cada tecla
    // (com debounce) na paleta de comandos.
    const candidates = await this.prisma.notebookEntry.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        textContent: true,
        date: true,
        area: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const matchIds = candidates
      .filter((entry) => {
        const dateLabel = entry.date.toLocaleDateString('pt-PT');
        return (
          entry.title.toLowerCase().includes(q) ||
          (entry.textContent ?? '').toLowerCase().includes(q) ||
          entry.area.name.toLowerCase().includes(q) ||
          dateLabel.includes(q)
        );
      })
      .slice(0, 50)
      .map((entry) => entry.id);
    if (matchIds.length === 0) return [];

    // 2.o passo: a entrada completa so para os resultados (max. 50), na
    // mesma ordem do 1.o passo.
    const rows = await this.prisma.notebookEntry.findMany({
      where: { id: { in: matchIds }, userId },
      include: {
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
        area: { select: { id: true, name: true, colorHex: true } },
      },
    });
    const order = new Map(matchIds.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return this.attachSignedUrlsMany(rows);
  }
}
