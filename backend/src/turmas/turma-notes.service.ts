import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaAccessService, TurmaMembership } from './turma-access.service';
import { CreateTurmaNoteDto, SaveTurmaNoteDto } from './dto/turma.dto';
import { MAX_NOTES_PER_TURMA, SEARCH_RESULTS_LIMIT } from './turmas.constants';

const NOTE_SELECT = {
  id: true,
  title: true,
  content: true,
  version: true,
  createdById: true,
  updatedAt: true,
  updatedBy: { select: { name: true } },
} satisfies Prisma.TurmaNoteSelect;

type NoteRow = Prisma.TurmaNoteGetPayload<{ select: typeof NOTE_SELECT }>;

function toView({ updatedBy, updatedAt, ...note }: NoteRow) {
  return {
    ...note,
    updatedAt: updatedAt.toISOString(),
    updatedByName: updatedBy?.name ?? null,
  };
}

@Injectable()
export class TurmaNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
  ) {}

  async list(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const notes = await this.prisma.turmaNote.findMany({
      where: { turmaId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    });
    return notes.map(({ updatedBy, updatedAt, ...note }) => ({
      ...note,
      updatedAt: updatedAt.toISOString(),
      updatedByName: updatedBy?.name ?? null,
    }));
  }

  // Pesquisa global (Ctrl+K): notas das turmas de que o utilizador e membro.
  async search(userId: string, query: string) {
    const q = query.trim();
    if (!q) return [];
    const notes = await this.prisma.turmaNote.findMany({
      where: {
        turma: { members: { some: { userId } } },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: SEARCH_RESULTS_LIMIT,
      select: {
        id: true,
        title: true,
        turmaId: true,
        turma: { select: { name: true } },
      },
    });
    return notes.map(({ turma, ...note }) => ({
      ...note,
      turmaName: turma.name,
    }));
  }

  async get(userId: string, turmaId: string, noteId: string) {
    await this.access.requireMember(userId, turmaId);
    return toView(await this.findOrThrow(turmaId, noteId));
  }

  async create(userId: string, turmaId: string, dto: CreateTurmaNoteDto) {
    const membership = await this.access.requireMember(userId, turmaId);
    this.assertCanEdit(membership);
    const count = await this.prisma.turmaNote.count({ where: { turmaId } });
    if (count >= MAX_NOTES_PER_TURMA) {
      throw new BadRequestException(
        `A turma can have at most ${MAX_NOTES_PER_TURMA} notes.`,
      );
    }
    const note = await this.prisma.turmaNote.create({
      data: {
        turmaId,
        title: dto.title,
        content: dto.content ?? '',
        version: 1,
        createdById: userId,
        updatedById: userId,
      },
      select: NOTE_SELECT,
    });
    return toView(note);
  }

  // Concorrencia otimista, igual ao Pad: so grava sobre a versao que o
  // cliente tinha; senao 409 com a nota atual.
  async save(
    userId: string,
    turmaId: string,
    noteId: string,
    dto: SaveTurmaNoteDto,
  ) {
    const membership = await this.access.requireMember(userId, turmaId);
    this.assertCanEdit(membership);
    const { count } = await this.prisma.turmaNote.updateMany({
      where: { id: noteId, turmaId, version: dto.baseVersion },
      data: {
        title: dto.title,
        content: dto.content,
        version: { increment: 1 },
        updatedById: userId,
      },
    });
    const current = toView(await this.findOrThrow(turmaId, noteId));
    if (count === 0) {
      throw new ConflictException({
        message: 'This note was changed by someone else.',
        current,
      });
    }
    return current;
  }

  async remove(userId: string, turmaId: string, noteId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const note = await this.findOrThrow(turmaId, noteId);
    this.access.assertDelegadoOrAuthor(membership, userId, note.createdById);
    await this.prisma.turmaNote.delete({ where: { id: note.id } });
    return { deleted: true };
  }

  private assertCanEdit(membership: TurmaMembership): void {
    if (!this.access.canEditNotes(membership)) {
      throw new ForbiddenException(
        'Only the delegado can edit notes in this turma.',
      );
    }
  }

  private async findOrThrow(turmaId: string, noteId: string) {
    const note = await this.prisma.turmaNote.findFirst({
      where: { id: noteId, turmaId },
      select: NOTE_SELECT,
    });
    if (!note) throw new NotFoundException('Note not found.');
    return note;
  }
}
