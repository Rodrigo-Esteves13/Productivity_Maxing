import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Difficulty, TurmaRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { TasksService } from '../tasks/tasks.service';
import { TurmaAccessService } from './turma-access.service';
import {
  AdoptTurmaDeadlineDto,
  CreateTurmaDeadlineDto,
  UpdateTurmaDeadlineDto,
} from './dto/turma.dto';
import { turmaPath } from './turmas.constants';

export const MAX_TURMA_DEADLINES = 300;
// Prazos que ja passaram continuam visiveis uns dias (para quem ainda nao
// os marcou como feitos), depois saem da lista.
const PAST_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Prazos partilhados da turma: registados uma vez, cada membro junta-os as
 * suas tasks. A task fica do membro (pode mudar dificuldade, notas, etc.),
 * mas titulo, data e peso seguem o prazo da turma quando este muda.
 */
@Injectable()
export class TurmaDeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly tasks: TasksService,
    private readonly push: PushService,
  ) {}

  async list(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const rows = await this.prisma.turmaDeadline.findMany({
      where: {
        turmaId,
        dueAt: { gte: new Date(Date.now() - PAST_GRACE_DAYS * DAY_MS) },
      },
      orderBy: { dueAt: 'asc' },
      take: MAX_TURMA_DEADLINES,
      select: {
        id: true,
        title: true,
        subject: true,
        dueAt: true,
        weightPercentage: true,
        kind: true,
        createdById: true,
        createdBy: { select: { name: true } },
        tasks: { where: { userId }, select: { taskId: true } },
        _count: { select: { tasks: true } },
      },
    });
    return rows.map(({ createdBy, tasks, _count, dueAt, ...row }) => ({
      ...row,
      dueAt: dueAt.toISOString(),
      createdByName: createdBy?.name ?? null,
      myTaskId: tasks[0]?.taskId ?? null,
      addedCount: _count.tasks,
    }));
  }

  async create(userId: string, turmaId: string, dto: CreateTurmaDeadlineDto) {
    const { turma } = await this.access.requireMember(userId, turmaId);
    const count = await this.prisma.turmaDeadline.count({ where: { turmaId } });
    if (count >= MAX_TURMA_DEADLINES) {
      throw new BadRequestException(
        `A class can have at most ${MAX_TURMA_DEADLINES} deadlines.`,
      );
    }
    const deadline = await this.prisma.turmaDeadline.create({
      data: {
        turmaId,
        createdById: userId,
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        dueAt: new Date(dto.dueAt),
        weightPercentage: dto.weightPercentage ?? null,
        kind: dto.kind,
      },
      select: { id: true },
    });
    const members = await this.prisma.turmaMember.findMany({
      where: { turmaId, userId: { not: userId } },
      select: { userId: true },
    });
    // notifyUser nunca lanca: um aviso falhado nao parte o registo.
    for (const member of members) {
      void this.push.notifyUser(member.userId, 'turmaDeadlineAdded', {
        name: turma.name,
        title: `${dto.subject.trim()}: ${dto.title.trim()}`,
        url: turmaPath(turmaId),
      });
    }
    return deadline;
  }

  async update(
    userId: string,
    turmaId: string,
    deadlineId: string,
    dto: UpdateTurmaDeadlineDto,
  ) {
    const { turma } = await this.requireEditor(userId, turmaId, deadlineId);
    const before = await this.prisma.turmaDeadline.findUniqueOrThrow({
      where: { id: deadlineId },
      select: { dueAt: true },
    });
    const updated = await this.prisma.turmaDeadline.update({
      where: { id: deadlineId },
      data: {
        title: dto.title?.trim(),
        subject: dto.subject?.trim(),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        weightPercentage: dto.weightPercentage,
        kind: dto.kind,
      },
      select: {
        title: true,
        subject: true,
        dueAt: true,
        weightPercentage: true,
        tasks: { select: { taskId: true, userId: true } },
      },
    });
    // Leva as mudancas para as tasks de quem ja juntou o prazo.
    if (updated.tasks.length > 0) {
      await this.prisma.task.updateMany({
        where: { id: { in: updated.tasks.map((t) => t.taskId) } },
        data: {
          title: updated.title,
          date: updated.dueAt,
          ...(dto.weightPercentage !== undefined && {
            weightPercentage: updated.weightPercentage,
          }),
        },
      });
    }
    if (updated.dueAt.getTime() !== before.dueAt.getTime()) {
      for (const link of updated.tasks) {
        if (link.userId === userId) continue;
        void this.push.notifyUser(link.userId, 'turmaDeadlineMoved', {
          name: turma.name,
          title: `${updated.subject}: ${updated.title}`,
          url: turmaPath(turmaId),
        });
      }
    }
    return { id: deadlineId };
  }

  async remove(userId: string, turmaId: string, deadlineId: string) {
    await this.requireEditor(userId, turmaId, deadlineId);
    // As tasks ja juntadas ficam: sao de cada membro.
    await this.prisma.turmaDeadline.delete({ where: { id: deadlineId } });
  }

  /** Cria a task do membro a partir do prazo, na cadeira que ele escolher. */
  async adopt(
    userId: string,
    turmaId: string,
    deadlineId: string,
    dto: AdoptTurmaDeadlineDto,
  ) {
    await this.access.requireMember(userId, turmaId);
    const deadline = await this.prisma.turmaDeadline.findFirst({
      where: { id: deadlineId, turmaId },
      select: {
        title: true,
        dueAt: true,
        weightPercentage: true,
        kind: true,
        tasks: { where: { userId }, select: { taskId: true } },
      },
    });
    if (!deadline) throw new NotFoundException('Deadline not found.');
    if (deadline.tasks.length > 0) {
      throw new ConflictException('Already in your tasks.');
    }
    const base = {
      areaId: dto.areaId,
      title: deadline.title,
      date: deadline.dueAt.toISOString(),
      type: 'ACADEMICO',
      academicType: deadline.kind,
      difficulty: Difficulty.MEDIUM,
    };
    let task: { id: string };
    try {
      task = await this.tasks.create(userId, {
        ...base,
        weightPercentage: deadline.weightPercentage,
      });
    } catch (error) {
      // Peso que nao cabe na cadeira deste membro (ja tem 100%): junta na
      // mesma, sem peso, em vez de falhar.
      if (
        !(error instanceof BadRequestException) ||
        !deadline.weightPercentage
      ) {
        throw error;
      }
      task = await this.tasks.create(userId, base);
    }
    await this.prisma.turmaDeadlineTask.create({
      data: { deadlineId, userId, taskId: task.id },
    });
    return { taskId: task.id };
  }

  private async requireEditor(
    userId: string,
    turmaId: string,
    deadlineId: string,
  ) {
    const membership = await this.access.requireMember(userId, turmaId);
    const row = await this.prisma.turmaDeadline.findFirst({
      where: { id: deadlineId, turmaId },
      select: { createdById: true },
    });
    if (!row) throw new NotFoundException('Deadline not found.');
    if (row.createdById !== userId && membership.role !== TurmaRole.DELEGADO) {
      throw new ForbiddenException('Only who added it or the class rep.');
    }
    return membership;
  }
}
