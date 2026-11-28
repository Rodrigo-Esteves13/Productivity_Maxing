import type { PrismaService } from '../prisma/prisma.service';
import { safePrismaSummary } from '../common/prisma-errors';
import type { RestoreTaskDto } from './dto/restore-tasks.dto';
import type { TasksService } from './tasks.service';
import type { Logger } from '@nestjs/common';

type CreatedTask = Awaited<ReturnType<TasksService['create']>>;

export interface RestoreOutcome {
  restored: { index: number; task: CreatedTask & { subtasks?: unknown[] } }[];
  // Posicoes (no pedido) que nao foi possivel recriar.
  failed: number[];
}

// Nunca no futuro; sem valor valido, o create usa o momento atual.
function pastDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return date.getTime() <= Date.now() ? date : undefined;
}

// "Anular" do apagar em massa: recria as tasks uma a uma pelo mesmo create()
// (posse da Area e do periodo, limite de peso, ordem), sem gastar um pedido
// HTTP por task. Uma que falhe nao para as outras.
export async function restoreTasks(
  deps: {
    prisma: PrismaService;
    create: TasksService['create'];
    logger: Logger;
  },
  userId: string,
  items: RestoreTaskDto[],
): Promise<RestoreOutcome> {
  const outcome: RestoreOutcome = { restored: [], failed: [] };
  for (const [index, item] of items.entries()) {
    const { subtasks = [], completedAt, ...dto } = item;
    try {
      const task = await deps.create(userId, dto, {
        completedAt: pastDate(completedAt),
      });
      outcome.restored.push({ index, task });
      if (subtasks.length === 0) continue;
      try {
        // task.id acabou de ser criado para este user.
        await deps.prisma.subtask.createMany({
          data: subtasks.map((subtask, sortOrder) => ({
            taskId: task.id,
            title: subtask.title,
            isDone: subtask.isDone,
            completedAt: subtask.isDone ? new Date() : null,
            sortOrder,
          })),
        });
        outcome.restored[outcome.restored.length - 1].task = {
          ...task,
          subtasks: await deps.prisma.subtask.findMany({
            where: { taskId: task.id, task: { userId } },
            orderBy: { sortOrder: 'asc' },
          }),
        };
      } catch (error) {
        // A task voltou; so a checklist se perdeu.
        deps.logger.warn(`Checklist nao reposta: ${safePrismaSummary(error)}`);
      }
    } catch (error) {
      deps.logger.warn(`Task nao reposta: ${safePrismaSummary(error)}`);
      outcome.failed.push(index);
    }
  }
  return outcome;
}
