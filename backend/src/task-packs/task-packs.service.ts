import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { DateCertainty, Effort, TaskPackItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  accessibleAreaWhere,
  assertAreaAccessible,
} from '../areas/area-access';
import type { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { CreateTaskPackDto, ImportTaskPackDto } from './dto/task-pack.dto';
import { MAX_PACKS_PER_USER } from './task-packs.constants';

export interface TaskPackSummary {
  id: string;
  name: string;
  code: string;
  itemCount: number;
  importCount: number;
  createdAt: string;
}

export interface TaskPackPreviewItem {
  id: string;
  title: string;
  date: string;
  weightPercentage: number | null;
  areaName: string;
  /** Area oficial fixa (igual para todos); null = quem importa escolhe. */
  fixedAreaId: string | null;
  /** Sugestao para areas pessoais: Area do importador com o mesmo nome. */
  suggestedAreaId: string | null;
  taskType: string;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  /** Dia em que a task abre (ainda nao da para comecar); null = ja aberta. */
  availableFrom: string | null;
  isBlocked: boolean;
  /** O importador ja tem uma task com este titulo e data. */
  alreadyHave: boolean;
}

export interface TaskPackPreview {
  name: string;
  ownerName: string;
  items: TaskPackPreviewItem[];
}

export interface ImportItemResult {
  itemId: string;
  ok: boolean;
  error?: string;
}

export interface ImportTaskPackResult {
  created: number;
  failed: number;
  /** Modo substituir: tasks apagadas antes de importar. */
  replaced: number;
  /** Modo substituir: tasks com nota/concluidas mantidas e ligadas ao pacote. */
  kept: number;
  results: ImportItemResult[];
}

interface ResolvedItem {
  item: TaskPackItem;
  areaId: string;
}

const COMPLETED_STATUS = 'COMPLETED';
const titleKey = (areaId: string, title: string) =>
  `${areaId}|${title.trim().toLowerCase()}`;

// Codigo curto mas nao adivinhavel (96 bits). Nunca derivado de ids/nomes.
const newCode = () => randomBytes(12).toString('base64url');

@Injectable()
export class TaskPacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateTaskPackDto,
  ): Promise<TaskPackSummary> {
    const count = await this.prisma.taskPack.count({ where: { ownerId } });
    if (count >= MAX_PACKS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_PACKS_PER_USER} task packs.`,
      );
    }

    // Só tarefas do próprio dono (IDOR): ids de outros simplesmente não aparecem.
    const tasks = await this.prisma.task.findMany({
      where: { userId: ownerId, id: { in: dto.taskIds } },
      select: {
        id: true,
        title: true,
        date: true,
        weightPercentage: true,
        effort: true,
        dateCertainty: true,
        availableFrom: true,
        isBlocked: true,
        areaId: true,
        area: { select: { name: true, ownerId: true } },
        taskType: { select: { key: true } },
        academicType: { select: { key: true } },
      },
    });
    if (tasks.length !== dto.taskIds.length) {
      throw new NotFoundException('Some of those tasks were not found.');
    }
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const pack = await this.prisma.taskPack.create({
      data: {
        ownerId,
        name: dto.name,
        code: newCode(),
        items: {
          create: dto.taskIds.map((id, position) => {
            const t = byId.get(id)!;
            return {
              position,
              title: t.title,
              dueDate: t.date,
              weightPercentage: t.weightPercentage,
              // Só Areas oficiais são iguais para toda a gente; o id de uma
              // Area pessoal nunca sai da conta do dono.
              areaId: t.area.ownerId === null ? t.areaId : null,
              areaName: t.area.name,
              taskType: t.taskType.key,
              academicType: t.academicType?.key ?? null,
              // Iguais para toda a turma: quanto trabalho da, se a data ja
              // esta marcada, quando o enunciado sai e se ainda nao da para
              // comecar.
              effort: t.effort,
              dateCertainty: t.dateCertainty,
              availableFrom: t.availableFrom,
              isBlocked: t.isBlocked,
              // Para o dono poder publicar alteracoes mais tarde (ver
              // TaskPackSyncService.publish).
              sourceTaskId: t.id,
            };
          }),
        },
      },
      include: { _count: { select: { items: true } } },
    });
    return this.toSummary(pack);
  }

  async list(ownerId: string): Promise<TaskPackSummary[]> {
    const packs = await this.prisma.taskPack.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return packs.map((p) => this.toSummary(p));
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.taskPack.deleteMany({
      where: { id, ownerId },
    });
    if (count === 0) throw new NotFoundException('Task pack not found.');
  }

  async preview(userId: string, code: string): Promise<TaskPackPreview> {
    const pack = await this.findByCodeOrThrow(code);
    const [areas, existing] = await Promise.all([
      this.prisma.area.findMany({
        where: accessibleAreaWhere(userId),
        select: { id: true, name: true },
      }),
      this.prisma.task.findMany({
        where: { userId, title: { in: pack.items.map((i) => i.title) } },
        select: { title: true, date: true },
      }),
    ]);
    const areaByName = new Map(areas.map((a) => [a.name.toLowerCase(), a.id]));
    const haveKey = (title: string, date: Date) =>
      `${title}|${date.toISOString()}`;
    const have = new Set(existing.map((t) => haveKey(t.title, t.date)));

    return {
      name: pack.name,
      ownerName: pack.owner.name ?? '',
      items: pack.items.map((i) => ({
        id: i.id,
        title: i.title,
        date: i.dueDate.toISOString(),
        weightPercentage: i.weightPercentage,
        areaName: i.areaName,
        fixedAreaId: i.areaId,
        suggestedAreaId:
          i.areaId ?? areaByName.get(i.areaName.toLowerCase()) ?? null,
        taskType: i.taskType,
        effort: i.effort,
        dateCertainty: i.dateCertainty,
        availableFrom: i.availableFrom?.toISOString() ?? null,
        isBlocked: i.isBlocked,
        alreadyHave: have.has(haveKey(i.title, i.dueDate)),
      })),
    };
  }

  /**
   * Cria as tarefas escolhidas na conta de quem importa, UMA a uma e pela
   * mesma TasksService.create de sempre (posse da Area, limite de 100% de peso,
   * periodo...). Data, peso, titulo, tipo, esforco e certeza da data vêm
   * SEMPRE do pacote, nunca do pedido; do cliente só vêm o item, a Area (se
   * pessoal) e o período.
   */
  async import(
    userId: string,
    code: string,
    dto: ImportTaskPackDto,
  ): Promise<ImportTaskPackResult> {
    const pack = await this.findByCodeOrThrow(code);
    const itemsById = new Map(pack.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const results: ImportItemResult[] = [];
    const resolved: ResolvedItem[] = [];

    for (const requested of dto.items) {
      if (seen.has(requested.itemId)) continue;
      seen.add(requested.itemId);

      const item = itemsById.get(requested.itemId);
      if (!item) {
        results.push({
          itemId: requested.itemId,
          ok: false,
          error: 'Item is not part of this pack.',
        });
        continue;
      }
      const areaId = item.areaId ?? requested.areaId;
      if (!areaId) {
        results.push({
          itemId: item.id,
          ok: false,
          error: 'Pick a subject for this task.',
        });
        continue;
      }

      resolved.push({ item, areaId });
    }

    const periodId = await this.tasksService.resolvePeriodId(
      userId,
      dto.periodId,
    );
    const replace = dto.replaceExisting
      ? await this.clearForReplace(userId, periodId, resolved)
      : { deleted: 0, keptByItem: new Map<string, string>() };

    for (const { item, areaId } of resolved) {
      const keptTaskId = replace.keptByItem.get(item.id);
      if (keptTaskId) {
        // A task com nota fica como esta, so passa a seguir o pacote.
        await this.prisma.task.update({
          where: { id: keptTaskId, userId },
          data: { packItemId: item.id, packItemVersion: item.version },
        });
        results.push({ itemId: item.id, ok: true });
        continue;
      }
      const taskDto: CreateTaskDto = {
        areaId,
        periodId,
        title: item.title,
        date: item.dueDate.toISOString(),
        type: item.taskType,
        academicType: item.academicType ?? undefined,
        weightPercentage: item.weightPercentage ?? undefined,
        difficulty: 'MEDIUM',
        effort: item.effort,
        dateCertainty: item.dateCertainty,
        availableFrom: item.availableFrom?.toISOString() ?? null,
        isBlocked: item.isBlocked,
      };
      try {
        const created = await this.tasksService.create(userId, taskDto);
        // Liga a task ao item para receber as atualizacoes do dono (sempre
        // com pedido de autorizacao, ver TaskPackSyncService).
        await this.prisma.task.update({
          where: { id: created.id, userId },
          data: { packItemId: item.id, packItemVersion: item.version },
        });
        results.push({ itemId: item.id, ok: true });
      } catch (error) {
        results.push({
          itemId: item.id,
          ok: false,
          // Mensagens de regra de negócio (peso>100%, área inválida...) são
          // seguras; erros internos viram uma mensagem genérica.
          error:
            error instanceof HttpException && error.getStatus() < 500
              ? error.message
              : 'Could not create this task.',
        });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    if (ok > 0) {
      await this.prisma.taskPack.update({
        where: { id: pack.id },
        data: { importCount: { increment: 1 } },
      });
    }
    const kept = replace.keptByItem.size;
    return {
      created: ok - kept,
      failed: results.length - ok,
      replaced: replace.deleted,
      kept,
      results,
    };
  }

  /**
   * Modo substituir: apaga as tasks do user no periodo e nas cadeiras que o
   * import vai preencher, para o pacote ficar no lugar delas (e o limite de
   * 100% de peso nao travar o import). Tasks com nota ou concluidas sao
   * historia e ficam; se o titulo bater com um item, passam a ser essa task
   * do pacote em vez de se criar uma copia.
   *
   * Cadeiras a que o user nao tem acesso saem antes de apagar: esses itens
   * iam falhar no create e nao se apaga nada que nao vai ser substituido.
   */
  private async clearForReplace(
    userId: string,
    periodId: string,
    resolved: ResolvedItem[],
  ): Promise<{ deleted: number; keptByItem: Map<string, string> }> {
    const areaIds: string[] = [];
    for (const areaId of new Set(resolved.map((r) => r.areaId))) {
      try {
        await assertAreaAccessible(this.prisma, userId, areaId);
        areaIds.push(areaId);
      } catch {
        // fica de fora: o item correspondente falha no create com a mensagem certa
      }
    }
    if (areaIds.length === 0) return { deleted: 0, keptByItem: new Map() };

    const existing = await this.prisma.task.findMany({
      where: { userId, periodId, areaId: { in: areaIds } },
      select: {
        id: true,
        title: true,
        areaId: true,
        realGrade: true,
        progressStatus: true,
      },
    });
    const isHistory = (t: (typeof existing)[number]) =>
      t.realGrade !== null || t.progressStatus === COMPLETED_STATUS;

    const keptByTitle = new Map<string, string>();
    for (const task of existing.filter(isHistory)) {
      keptByTitle.set(titleKey(task.areaId, task.title), task.id);
    }
    const keptByItem = new Map<string, string>();
    const usedKept = new Set<string>();
    for (const { item, areaId } of resolved) {
      const taskId = keptByTitle.get(titleKey(areaId, item.title));
      if (taskId && !usedKept.has(taskId)) {
        keptByItem.set(item.id, taskId);
        usedKept.add(taskId);
      }
    }

    const toDelete = existing.filter((t) => !isHistory(t)).map((t) => t.id);
    if (toDelete.length === 0) return { deleted: 0, keptByItem };
    const { count } = await this.tasksService.bulkRemove(userId, toDelete);
    return { deleted: count, keptByItem };
  }

  private async findByCodeOrThrow(code: string) {
    const pack = await this.prisma.taskPack.findUnique({
      where: { code },
      include: {
        owner: { select: { name: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });
    if (!pack) {
      throw new NotFoundException(
        'This task pack link is invalid or was removed.',
      );
    }
    return pack;
  }

  private toSummary(pack: {
    id: string;
    name: string;
    code: string;
    importCount: number;
    createdAt: Date;
    _count: { items: number };
  }): TaskPackSummary {
    return {
      id: pack.id,
      name: pack.name,
      code: pack.code,
      itemCount: pack._count.items,
      importCount: pack.importCount,
      createdAt: pack.createdAt.toISOString(),
    };
  }
}
