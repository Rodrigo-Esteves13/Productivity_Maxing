import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SharedEditDto } from './dto/shared-edit.dto';
import { PushService } from '../push/push.service';
import { resolveShareAccess, type SharedRole } from './share-role.util';

export type { SharedRole };

// Campos que uma partilha pode alterar (ver SharedEditDto).
export interface EditableFields {
  title?: string;
  textContent?: string;
  usefulLinks?: { id: string; label: string; url: string }[];
}

function pickEditableFields(dto: SharedEditDto): EditableFields {
  const fields: EditableFields = {};
  if (dto.title !== undefined) fields.title = dto.title;
  if (dto.textContent !== undefined) fields.textContent = dto.textContent;
  if (dto.usefulLinks !== undefined) {
    fields.usefulLinks = dto.usefulLinks.map((l) => ({
      id: l.id,
      label: l.label,
      url: l.url,
    }));
  }
  return fields;
}

// Le o payload guardado numa proposta de volta para campos editaveis,
// ignorando qualquer chave desconhecida (o payload e JSON livre na BD).
function fieldsFromPayload(payload: Prisma.JsonValue): EditableFields {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const raw = payload as Record<string, unknown>;
  const fields: EditableFields = {};
  if (typeof raw.title === 'string' && raw.title.trim()) {
    fields.title = raw.title;
  }
  if (typeof raw.textContent === 'string') fields.textContent = raw.textContent;
  if (Array.isArray(raw.usefulLinks)) {
    fields.usefulLinks = raw.usefulLinks as EditableFields['usefulLinks'];
  }
  return fields;
}

function toEntryData(fields: EditableFields) {
  return {
    title: fields.title,
    textContent: fields.textContent,
    usefulLinks: fields.usefulLinks,
  } as Prisma.NotebookEntryUpdateArgs['data'];
}

@Injectable()
export class NotebookCollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // Papel de quem abre /shared/:token. Papeis acima de VIEWER so existem
  // em partilhas AUTHORIZED com pedido APPROVED - num link PUBLIC toda a
  // gente (com ou sem conta) e VIEWER.
  private async resolveRole(token: string, userId: string) {
    const share = await this.prisma.notebookShare.findUnique({
      where: { token },
    });
    if (!share) {
      throw new NotFoundException('This share link is invalid or was removed.');
    }
    const access = await resolveShareAccess(this.prisma, share, userId);
    const role: SharedRole = access.state === 'ok' ? access.role : 'VIEWER';
    return { share, role };
  }

  private async assertOwnsEntry(ownerId: string, entryId: string) {
    const entry = await this.prisma.notebookEntry.findFirst({
      where: { id: entryId, userId: ownerId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException(
        `Notebook entry not found or you don't have access.`,
      );
    }
  }

  /**
   * Edicao por uma partilha. OWNER/CO_OWNER aplicam logo; EDITOR cria (ou
   * substitui) a sua proposta PENDING para o dono aprovar; VIEWER nao pode.
   */
  async editShared(userId: string, token: string, dto: SharedEditDto) {
    const { share, role } = await this.resolveRole(token, userId);
    const fields = pickEditableFields(dto);
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException('Nothing to change.');
    }

    if (role === 'OWNER' || role === 'CO_OWNER') {
      await this.prisma.notebookEntry.update({
        where: { id: share.notebookEntryId },
        data: toEntryData(fields),
      });
      return { applied: true as const };
    }

    if (role === 'EDITOR') {
      const existing = await this.prisma.notebookChangeProposal.findFirst({
        where: {
          notebookEntryId: share.notebookEntryId,
          proposedByUserId: userId,
          status: 'PENDING',
        },
        select: { id: true },
      });
      const data = {
        payload: fields as unknown as Prisma.InputJsonValue,
        note: dto.note?.trim() || null,
      };
      const proposal = existing
        ? await this.prisma.notebookChangeProposal.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.notebookChangeProposal.create({
            data: {
              ...data,
              notebookEntryId: share.notebookEntryId,
              proposedByUserId: userId,
            },
          });

      // Só avisa o dono quando a proposta é NOVA (substituir a própria
      // proposta não volta a apitar).
      if (!existing) {
        const [proposer, entry] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
          }),
          this.prisma.notebookEntry.findUnique({
            where: { id: share.notebookEntryId },
            select: { title: true },
          }),
        ]);
        void this.push.notifyUser(
          share.createdByUserId,
          'shareProposalReceived',
          {
            name: proposer?.name ?? proposer?.email?.split('@')[0] ?? '',
            title: entry?.title ?? '',
            url: '/notebook',
          },
        );
      }
      return { applied: false as const, proposalId: proposal.id };
    }

    throw new ForbiddenException(
      'You only have view access to this lesson. Ask the owner for editor access.',
    );
  }

  // Lado do dono: propostas por decidir desta entrada.
  async listProposals(ownerId: string, entryId: string) {
    await this.assertOwnsEntry(ownerId, entryId);
    const rows = await this.prisma.notebookChangeProposal.findMany({
      where: { notebookEntryId: entryId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        note: true,
        payload: true,
        createdAt: true,
        proposedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
    // Propostas de amigos convidados: sem email (so o nome).
    const invited = await this.prisma.notebookShareAccessRequest.findMany({
      where: {
        invitedByOwner: true,
        requestingUserId: { in: rows.map((r) => r.proposedBy.id) },
        notebookShare: { notebookEntryId: entryId },
      },
      select: { requestingUserId: true },
    });
    const hideEmail = new Set(invited.map((i) => i.requestingUserId));
    return rows.map((row) => ({
      ...row,
      proposedBy: hideEmail.has(row.proposedBy.id)
        ? { ...row.proposedBy, email: '' }
        : row.proposedBy,
      payload: fieldsFromPayload(row.payload),
    }));
  }

  // Aprovar aplica os campos propostos a entrada; recusar so fecha a
  // proposta. entryId e proposalId verificados juntos (defesa contra IDOR,
  // como em decideAccessRequest).
  async decideProposal(
    ownerId: string,
    entryId: string,
    proposalId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    await this.assertOwnsEntry(ownerId, entryId);
    const proposal = await this.prisma.notebookChangeProposal.findFirst({
      where: { id: proposalId, notebookEntryId: entryId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found.');
    if (proposal.status !== 'PENDING') {
      throw new ConflictException('This proposal was already decided.');
    }

    const decided = { status: decision, decidedAt: new Date() };
    const notifyProposer = async () => {
      const info = await this.prisma.notebookEntry.findUnique({
        where: { id: entryId },
        select: { title: true, share: { select: { token: true } } },
      });
      void this.push.notifyUser(
        proposal.proposedByUserId,
        decision === 'APPROVED'
          ? 'shareProposalApproved'
          : 'shareProposalRejected',
        {
          title: info?.title ?? '',
          url: info?.share ? `/shared/${info.share.token}` : '/notebook',
        },
      );
    };
    if (decision === 'REJECTED') {
      const updated = await this.prisma.notebookChangeProposal.update({
        where: { id: proposalId },
        data: decided,
      });
      await notifyProposer();
      return { id: updated.id, status: updated.status };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.notebookEntry.update({
        where: { id: entryId },
        data: toEntryData(fieldsFromPayload(proposal.payload)),
      }),
      this.prisma.notebookChangeProposal.update({
        where: { id: proposalId },
        data: decided,
      }),
    ]);
    await notifyProposer();
    return { id: updated.id, status: updated.status };
  }
}
