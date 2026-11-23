import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskPackUpdateStatus } from '@prisma/client';
import type { DateCertainty, Effort } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { PushService } from '../push/push.service';
import type { UpdateTaskDto } from '../tasks/dto/update-task.dto';
import { PACK_UPDATES_PAGE_SIZE } from './task-packs.constants';

/**
 * Campos de um item que sao iguais para toda a turma e por isso podem ser
 * atualizados pelo dono. Valores ja em forma de JSON (datas em ISO) porque
 * vao assim para TaskPackUpdate.changes e para o frontend.
 */
export interface PackSharedFields {
  title: string;
  date: string;
  weightPercentage: number | null;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  availableFrom: string | null;
  isBlocked: boolean;
  /** Entrega antes da apresentacao (trabalho em duas fases); null = uma fase. */
  submissionDate: string | null;
}

export type PackChanges = Partial<PackSharedFields>;

export interface PackSyncResult {
  updatedItems: number;
  proposalsCreated: number;
}

export interface PackUpdateView {
  id: string;
  taskId: string;
  taskTitle: string;
  packName: string;
  ownerName: string;
  changes: PackChanges;
  current: PackSharedFields;
  createdAt: string;
}

const SHARED_KEYS: readonly (keyof PackSharedFields)[] = [
  'title',
  'date',
  'weightPercentage',
  'effort',
  'dateCertainty',
  'availableFrom',
  'isBlocked',
  'submissionDate',
];

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

interface SharedRow {
  title: string;
  weightPercentage: number | null;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  availableFrom: Date | null;
  isBlocked: boolean;
  submissionDate: Date | null;
}

const fromTask = (t: SharedRow & { date: Date }): PackSharedFields => ({
  title: t.title,
  date: t.date.toISOString(),
  weightPercentage: t.weightPercentage,
  effort: t.effort,
  dateCertainty: t.dateCertainty,
  availableFrom: iso(t.availableFrom),
  isBlocked: t.isBlocked,
  submissionDate: iso(t.submissionDate),
});

const fromItem = (i: SharedRow & { dueDate: Date }): PackSharedFields =>
  fromTask({ ...i, date: i.dueDate });

/** Campos de `next` diferentes de `prev` (com o valor de `next`). */
export function diffShared(
  prev: PackSharedFields,
  next: PackSharedFields,
): PackChanges {
  const changes: Record<string, unknown> = {};
  for (const key of SHARED_KEYS) {
    if (prev[key] !== next[key]) changes[key] = next[key];
  }
  return changes;
}

// Le o JSON guardado de volta, so com chaves conhecidas (o JSON e escrito
// pelo servidor, mas a coluna e Json e nao tem tipo na BD).
function readChanges(raw: Prisma.JsonValue): PackChanges {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const key of SHARED_KEYS) {
    if (key in raw) out[key] = (raw as Record<string, unknown>)[key];
  }
  return out;
}

const SHARED_TASK_SELECT = {
  title: true,
  date: true,
  weightPercentage: true,
  effort: true,
  dateCertainty: true,
  availableFrom: true,
  isBlocked: true,
  submissionDate: true,
} satisfies Prisma.TaskSelect;

const IMPORTED_TASK_SELECT = {
  id: true,
  userId: true,
  packItemId: true,
  ...SHARED_TASK_SELECT,
  packUpdates: {
    where: { status: TaskPackUpdateStatus.PENDING },
    select: { id: true, changes: true },
  },
} satisfies Prisma.TaskSelect;

type ImportedTaskRow = Prisma.TaskGetPayload<{
  select: typeof IMPORTED_TASK_SELECT;
}>;

@Injectable()
export class TaskPackSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly push: PushService,
  ) {}

  /**
   * O dono publica as alteracoes que fez as SUAS tasks de origem. Cada item
   * que mudou sobe de versao e cada colega que o importou recebe um pedido
   * (TaskPackUpdate PENDING) com o que mudou. Nada muda na conta dos outros
   * sem eles aceitarem.
   */
  async publish(ownerId: string, packId: string): Promise<PackSyncResult> {
    await this.linkLegacyItems(ownerId, packId);
    const pack = await this.prisma.taskPack.findFirst({
      where: { id: packId, ownerId },
      select: {
        id: true,
        name: true,
        owner: { select: { name: true } },
        items: {
          // Só tasks de origem do próprio dono (IDOR em profundidade: o
          // item foi criado assim, mas o filtro não custa nada).
          where: { sourceTask: { userId: ownerId } },
          select: {
            id: true,
            version: true,
            title: true,
            dueDate: true,
            weightPercentage: true,
            effort: true,
            dateCertainty: true,
            availableFrom: true,
            isBlocked: true,
            submissionDate: true,
            sourceTask: { select: SHARED_TASK_SELECT },
          },
        },
      },
    });
    if (!pack) throw new NotFoundException('Task pack not found.');

    let updatedItems = 0;
    let proposalsCreated = 0;
    const notifyUserIds = new Set<string>();

    const changedItems = pack.items.flatMap((item) => {
      if (!item.sourceTask) return [];
      const itemChanges = diffShared(fromItem(item), fromTask(item.sourceTask));
      if (Object.keys(itemChanges).length === 0) return [];
      return [{ item, next: fromTask(item.sourceTask), itemChanges }];
    });
    // Um so pedido para as tasks importadas de todos os itens alterados.
    const importedByItem = await this.loadImportedTasks(
      changedItems.map((c) => c.item.id),
    );

    for (const { item, next, itemChanges } of changedItems) {
      const version = item.version + 1;
      const importedTasks = importedByItem.get(item.id) ?? [];

      const writes: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.taskPackItem.update({
          where: { id: item.id },
          data: {
            version,
            title: next.title,
            dueDate: new Date(next.date),
            weightPercentage: next.weightPercentage,
            effort: next.effort,
            dateCertainty: next.dateCertainty,
            availableFrom: next.availableFrom
              ? new Date(next.availableFrom)
              : null,
            isBlocked: next.isBlocked,
            submissionDate: next.submissionDate
              ? new Date(next.submissionDate)
              : null,
          },
        }),
      ];

      for (const task of importedTasks) {
        // Pedido ainda por responder: junta-se (o novo ganha) para haver
        // sempre no maximo um por task.
        const pendingChanges = task.packUpdates.reduce<PackChanges>(
          (acc, u) => ({ ...acc, ...readChanges(u.changes) }),
          {},
        );
        const proposed = { ...pendingChanges, ...itemChanges };
        // So o que ainda e diferente na task da pessoa (pode ja ter mudado
        // a mao para o mesmo valor).
        const current = fromTask(task);
        const changes = diffShared(current, { ...current, ...proposed });
        if (task.packUpdates.length > 0) {
          writes.push(
            this.prisma.taskPackUpdate.deleteMany({
              where: { taskId: task.id, status: TaskPackUpdateStatus.PENDING },
            }),
          );
        }
        if (Object.keys(changes).length === 0) continue;
        writes.push(
          this.prisma.taskPackUpdate.create({
            data: {
              userId: task.userId,
              taskId: task.id,
              packItemId: item.id,
              version,
              changes: changes,
            },
          }),
        );
        proposalsCreated += 1;
        notifyUserIds.add(task.userId);
      }

      await this.prisma.$transaction(writes);
      updatedItems += 1;
    }

    for (const userId of notifyUserIds) {
      void this.push.notifyUserOnce(
        userId,
        'taskPackUpdated',
        {
          name: pack.owner.name ?? '',
          title: pack.name,
          url: '/task-packs',
        },
        `taskPackUpdated:${pack.id}:${userId}`,
      );
    }
    return { updatedItems, proposalsCreated };
  }

  private async loadImportedTasks(packItemIds: string[]) {
    const byItem = new Map<string, ImportedTaskRow[]>();
    if (packItemIds.length === 0) return byItem;
    const tasks = await this.prisma.task.findMany({
      where: { packItemId: { in: packItemIds } },
      select: IMPORTED_TASK_SELECT,
    });
    for (const task of tasks) {
      if (!task.packItemId) continue;
      const list = byItem.get(task.packItemId) ?? [];
      list.push(task);
      byItem.set(task.packItemId, list);
    }
    return byItem;
  }

  /**
   * Pacotes criados antes de haver sync nao sabem de que task do dono veio
   * cada item, nem que tasks dos colegas vieram dele. Liga-os uma vez, antes
   * do primeiro "Publish updates":
   * - origem: task do DONO com o mesmo titulo (e a mesma Area oficial, se o
   *   item a tiver); varias candidatas -> a de data mais perto da do item.
   * - importadas: tasks de outros com o mesmo titulo e EXATAMENTE a data do
   *   item (o import copia-a ao milissegundo), ainda sem ligacao, e na mesma
   *   Area oficial quando a ha. Cada uma so recebe um pedido para aprovar.
   */
  private async linkLegacyItems(ownerId: string, packId: string) {
    const items = await this.prisma.taskPackItem.findMany({
      where: { packId, pack: { ownerId }, sourceTaskId: null },
      select: {
        id: true,
        title: true,
        dueDate: true,
        areaId: true,
        version: true,
      },
    });
    if (items.length === 0) return;
    const titles = [...new Set(items.map((i) => i.title))];
    const dates = [...new Set(items.map((i) => i.dueDate))];
    // Um findMany para as origens (tasks do dono) e outro para as tasks
    // importadas ainda sem ligacao, em vez de dois por item.
    const [ownerTasks, orphanTasks] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId: ownerId, title: { in: titles } },
        select: { id: true, title: true, date: true, areaId: true },
      }),
      this.prisma.task.findMany({
        where: {
          userId: { not: ownerId },
          packItemId: null,
          title: { in: titles },
          date: { in: dates },
        },
        select: { id: true, title: true, date: true, areaId: true },
      }),
    ]);
    const sameArea = (itemAreaId: string | null, taskAreaId: string | null) =>
      !itemAreaId || taskAreaId === itemAreaId;
    // Cada task importada so e ligada ao primeiro item que a reclama.
    const claimed = new Set<string>();
    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const item of items) {
      const distance = (d: Date) =>
        Math.abs(d.getTime() - item.dueDate.getTime());
      const source = ownerTasks
        .filter(
          (t) => t.title === item.title && sameArea(item.areaId, t.areaId),
        )
        .sort((a, b) => distance(a.date) - distance(b.date))[0];
      if (source) {
        writes.push(
          this.prisma.taskPackItem.update({
            where: { id: item.id },
            data: { sourceTaskId: source.id },
          }),
        );
      }
      const matchedIds = orphanTasks
        .filter(
          (t) =>
            !claimed.has(t.id) &&
            t.title === item.title &&
            t.date.getTime() === item.dueDate.getTime() &&
            sameArea(item.areaId, t.areaId),
        )
        .map((t) => t.id);
      if (matchedIds.length === 0) continue;
      matchedIds.forEach((id) => claimed.add(id));
      writes.push(
        this.prisma.task.updateMany({
          where: {
            id: { in: matchedIds },
            userId: { not: ownerId },
            packItemId: null,
          },
          data: { packItemId: item.id, packItemVersion: item.version },
        }),
      );
    }
    if (writes.length > 0) await this.prisma.$transaction(writes);
  }

  async listPending(userId: string): Promise<PackUpdateView[]> {
    const updates = await this.prisma.taskPackUpdate.findMany({
      where: { userId, status: TaskPackUpdateStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: PACK_UPDATES_PAGE_SIZE,
      select: {
        id: true,
        changes: true,
        createdAt: true,
        task: { select: { id: true, ...SHARED_TASK_SELECT } },
        packItem: {
          select: {
            pack: { select: { name: true, owner: { select: { name: true } } } },
          },
        },
      },
    });
    return updates.map((u) => ({
      id: u.id,
      taskId: u.task.id,
      taskTitle: u.task.title,
      packName: u.packItem.pack.name,
      ownerName: u.packItem.pack.owner.name ?? '',
      changes: readChanges(u.changes),
      current: fromTask(u.task),
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /**
   * Aplica o pedido pela TasksService.update de sempre (posse, limite de
   * 100% de peso, contagem de adiamentos...). Se essa validacao falhar, o
   * pedido fica PENDING e o erro de regra de negocio volta ao user.
   */
  async accept(userId: string, updateId: string) {
    const update = await this.findPendingOrThrow(userId, updateId);
    const changes = readChanges(update.changes);
    const dto: UpdateTaskDto = { ...changes };
    // Mudanca de data vinda do dono do pacote nao e um adiamento teu.
    const task = await this.tasksService.update(userId, update.taskId, dto, {
      countPostpone: false,
    });
    await this.prisma.$transaction([
      this.prisma.taskPackUpdate.update({
        where: { id: update.id },
        data: { status: TaskPackUpdateStatus.ACCEPTED, decidedAt: new Date() },
      }),
      this.prisma.task.update({
        where: { id: update.taskId, userId },
        data: { packItemVersion: update.version },
      }),
    ]);
    return task;
  }

  async reject(userId: string, updateId: string): Promise<void> {
    const update = await this.findPendingOrThrow(userId, updateId);
    await this.prisma.$transaction([
      this.prisma.taskPackUpdate.update({
        where: { id: update.id },
        data: { status: TaskPackUpdateStatus.REJECTED, decidedAt: new Date() },
      }),
      // Recusar = "fico com a minha versao": nao volta a propor esta.
      this.prisma.task.update({
        where: { id: update.taskId, userId },
        data: { packItemVersion: update.version },
      }),
    ]);
  }

  private async findPendingOrThrow(userId: string, id: string) {
    const update = await this.prisma.taskPackUpdate.findFirst({
      where: { id, userId, status: TaskPackUpdateStatus.PENDING },
      select: { id: true, taskId: true, version: true, changes: true },
    });
    if (!update) throw new NotFoundException('Update not found.');
    return update;
  }
}
