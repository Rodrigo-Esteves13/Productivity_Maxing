import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_SUBTASKS_PER_TASK, UpdateSubtaskDto } from './dto/subtask.dto';

// Checklist leve dentro de uma Task (ver model Subtask no schema). Todas as
// operações validam primeiro que a task é do utilizador (defesa contra
// IDOR, mesmo padrão do TasksService) - o subtaskId sozinho nunca basta.
@Injectable()
export class SubtasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTaskOwned(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found.');
  }

  async list(userId: string, taskId: string) {
    await this.assertTaskOwned(userId, taskId);
    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, taskId: string, title: string) {
    const [created] = await this.createMany(userId, taskId, [title]);
    return created;
  }

  async createMany(userId: string, taskId: string, titles: string[]) {
    await this.assertTaskOwned(userId, taskId);

    const clean = titles.map((t) => t.trim()).filter((t) => t.length > 0);
    if (clean.length === 0) {
      throw new BadRequestException('Subtask title cannot be empty.');
    }

    const [count, last] = await Promise.all([
      this.prisma.subtask.count({ where: { taskId } }),
      this.prisma.subtask.aggregate({
        where: { taskId },
        _max: { sortOrder: true },
      }),
    ]);
    if (count + clean.length > MAX_SUBTASKS_PER_TASK) {
      throw new BadRequestException(
        `A task can have at most ${MAX_SUBTASKS_PER_TASK} subtasks.`,
      );
    }

    const firstOrder = (last._max.sortOrder ?? -1) + 1;
    // Transação: ou entram todas ou nenhuma (um duplicar a meio deixava a
    // checklist da cópia incompleta).
    return this.prisma.$transaction(
      clean.map((title, i) =>
        this.prisma.subtask.create({
          data: { taskId, title, sortOrder: firstOrder + i },
        }),
      ),
    );
  }

  async update(
    userId: string,
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ) {
    await this.assertTaskOwned(userId, taskId);
    const existing = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!existing) throw new NotFoundException('Subtask not found.');

    const data: {
      title?: string;
      isDone?: boolean;
      completedAt?: Date | null;
    } = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title)
        throw new BadRequestException('Subtask title cannot be empty.');
      data.title = title;
    }
    if (dto.isDone !== undefined && dto.isDone !== existing.isDone) {
      data.isDone = dto.isDone;
      data.completedAt = dto.isDone ? new Date() : null;
    }

    return this.prisma.subtask.update({ where: { id: subtaskId }, data });
  }

  async remove(userId: string, taskId: string, subtaskId: string) {
    await this.assertTaskOwned(userId, taskId);
    // deleteMany com taskId no where: a condição de posse não depende só do
    // assertTaskOwned acima, e um id de outra task simplesmente não apaga
    // nada.
    const result = await this.prisma.subtask.deleteMany({
      where: { id: subtaskId, taskId },
    });
    if (result.count === 0) throw new NotFoundException('Subtask not found.');
  }

  /** Aplica uma nova ordem manual; ids que não são desta task são ignorados. */
  async reorder(userId: string, taskId: string, subtaskIds: string[]) {
    await this.assertTaskOwned(userId, taskId);
    const owned = await this.prisma.subtask.findMany({
      where: { taskId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const ordered = subtaskIds.filter((id) => ownedIds.has(id));

    await this.prisma.$transaction(
      ordered.map((id, index) =>
        this.prisma.subtask.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.list(userId, taskId);
  }
}
