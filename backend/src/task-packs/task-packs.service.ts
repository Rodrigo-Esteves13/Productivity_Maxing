import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type {
  DateCertainty,
  Effort,
  Prisma,
  TaskPackItem,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { runWithUserTaskLock } from '../tasks/user-lock.util';
import {
  accessibleAreaWhere,
  assertAreaAccessible,
} from '../areas/area-access';
import type { CreateTaskDto } from '../tasks/dto/create-task.dto';
import {
  CreateTaskPackDto,
  ImportTaskPackDto,
  RenameTaskPackDto,
} from './dto/task-pack.dto';
import { MAX_PACKS_PER_USER } from './task-packs.constants';
import { findOwnPackSources, packItemFromTask } from './task-pack-source';

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
  /** Entrega antes da apresentacao (`date`); null = uma so fase. */
  submissionDate: string | null;
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

interface ReplacePlan {
  toDelete: string[];
  keptByItem: Map<string, string>;
}

interface ImportOutcome {
  results: ImportItemResult[];
  replaced: number;
  kept: number;
}

// Modo substituir e tudo ou nada: os itens que nao falharam levam esta
// mensagem, o que falhou leva o motivo real.
const REPLACE_ABORTED_MESSAGE =
  'Not imported: another task in this pack failed, so nothing was replaced.';
const IMPORT_GENERIC_ERROR = 'Could not create this task.';

// Lancado dentro da transacao do modo substituir para a fazer voltar atras.
class ReplaceAbortedError extends Error {
  constructor(
    readonly itemId: string,
    readonly reason: string,
  ) {
    super(reason);
  }
}

// Mensagens de regra de negocio (peso>100%, area invalida...) sao seguras;
// erros internos viram uma mensagem generica.
function importErrorMessage(error: unknown): string {
  return error instanceof HttpException && error.getStatus() < 500
    ? error.message
    : IMPORT_GENERIC_ERROR;
}

// Data, peso, titulo, tipo, esforco e certeza da data vem SEMPRE do item.
function packItemTaskDto(
  item: TaskPackItem,
  areaId: string,
  periodId: string,
): CreateTaskDto {
  return {
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
    submissionDate: item.submissionDate?.toISOString() ?? null,
  };
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

    const tasks = await findOwnPackSources(this.prisma, ownerId, dto.taskIds);
    const byId = new Map(tasks.map((t) => [t.id, t]));

    const pack = await this.prisma.taskPack.create({
      data: {
        ownerId,
        name: dto.name,
        code: newCode(),
        items: {
          create: dto.taskIds.map((id, position) =>
            packItemFromTask(byId.get(id)!, position),
          ),
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

  // So o nome: o codigo partilhado e os itens ficam iguais.
  async rename(
    ownerId: string,
    id: string,
    dto: RenameTaskPackDto,
  ): Promise<TaskPackSummary> {
    const { count } = await this.prisma.taskPack.updateMany({
      where: { id, ownerId },
      data: { name: dto.name },
    });
    if (count === 0) throw new NotFoundException('Task pack not found.');
    const pack = await this.prisma.taskPack.findFirst({
      where: { id, ownerId },
      include: { _count: { select: { items: true } } },
    });
    if (!pack) throw new NotFoundException('Task pack not found.');
    return this.toSummary(pack);
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
        submissionDate: i.submissionDate?.toISOString() ?? null,
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
    const outcome = dto.replaceExisting
      ? await this.importReplacing(userId, periodId, resolved)
      : await this.importAdding(userId, periodId, resolved);
    results.push(...outcome.results);

    const ok = results.filter((r) => r.ok).length;
    if (ok > 0) {
      await this.prisma.taskPack.update({
        where: { id: pack.id },
        data: { importCount: { increment: 1 } },
      });
    }
    return {
      created: ok - outcome.kept,
      failed: results.length - ok,
      replaced: outcome.replaced,
      kept: outcome.kept,
      results,
    };
  }

  /** Modo normal: cada task e independente, uma falha nao trava as outras. */
  private async importAdding(
    userId: string,
    periodId: string,
    resolved: ResolvedItem[],
  ): Promise<ImportOutcome> {
    const results: ImportItemResult[] = [];
    for (const { item, areaId } of resolved) {
      try {
        // packItem liga a task ao item para receber as atualizacoes do dono
        // (sempre com pedido de autorizacao, ver TaskPackSyncService).
        await this.tasksService.create(
          userId,
          packItemTaskDto(item, areaId, periodId),
          {
            packItem: { id: item.id, version: item.version },
            weightExcludeTaskIds: [],
          },
        );
        results.push({ itemId: item.id, ok: true });
      } catch (error) {
        results.push({
          itemId: item.id,
          ok: false,
          error: importErrorMessage(error),
        });
      }
    }
    return { results, replaced: 0, kept: 0 };
  }

  /**
   * Modo substituir (B-27): tudo ou nada, numa so transacao com o lock de
   * escrita de tasks do user. Creates, ligacao das tasks mantidas e o
   * apagar das antigas fazem commit juntos; ao primeiro item que falha a
   * transacao volta atras e o user fica exatamente com o que tinha. Os
   * anexos das tasks apagadas so saem do storage depois do commit.
   */
  private async importReplacing(
    userId: string,
    periodId: string,
    resolved: ResolvedItem[],
  ): Promise<ImportOutcome> {
    const plan = await this.planReplace(userId, periodId, resolved);
    try {
      const removed = await runWithUserTaskLock(
        this.prisma,
        userId,
        async (tx) => {
          for (const { item, areaId } of resolved) {
            await this.replaceItemInTx(tx, userId, periodId, plan, {
              item,
              areaId,
            });
          }
          return plan.toDelete.length > 0
            ? this.tasksService.bulkRemoveInTx(tx, userId, plan.toDelete)
            : { count: 0, storagePaths: [] as string[] };
        },
      );
      await this.tasksService.removeAttachmentFiles(removed.storagePaths);
      return {
        results: resolved.map(({ item }) => ({ itemId: item.id, ok: true })),
        replaced: removed.count,
        kept: plan.keptByItem.size,
      };
    } catch (error) {
      if (!(error instanceof ReplaceAbortedError)) throw error;
      // Rollback feito: nenhum item ficou importado.
      return {
        results: resolved.map(({ item }) => ({
          itemId: item.id,
          ok: false,
          error:
            item.id === error.itemId ? error.reason : REPLACE_ABORTED_MESSAGE,
        })),
        replaced: 0,
        kept: 0,
      };
    }
  }

  private async replaceItemInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    periodId: string,
    plan: ReplacePlan,
    { item, areaId }: ResolvedItem,
  ): Promise<void> {
    try {
      const keptTaskId = plan.keptByItem.get(item.id);
      if (keptTaskId) {
        // A task com nota fica como esta, so passa a seguir o pacote.
        await tx.task.update({
          where: { id: keptTaskId, userId },
          data: { packItemId: item.id, packItemVersion: item.version },
        });
        return;
      }
      await this.tasksService.create(
        userId,
        packItemTaskDto(item, areaId, periodId),
        {
          tx,
          packItem: { id: item.id, version: item.version },
          weightExcludeTaskIds: plan.toDelete,
        },
      );
    } catch (error) {
      throw new ReplaceAbortedError(item.id, importErrorMessage(error));
    }
  }

  /**
   * Modo substituir: decide que tasks do user, no periodo e nas cadeiras que
   * o import vai preencher, saem para o pacote ficar no lugar delas (o limite
   * de 100% de peso ignora-as). NAO apaga: quem chama apaga depois dos creates. Tasks com nota ou concluidas sao
   * historia e ficam; se o titulo bater com um item, passam a ser essa task
   * do pacote em vez de se criar uma copia.
   *
   * Cadeiras a que o user nao tem acesso saem antes de apagar: esses itens
   * iam falhar no create e nao se apaga nada que nao vai ser substituido.
   */
  private async planReplace(
    userId: string,
    periodId: string,
    resolved: ResolvedItem[],
  ): Promise<ReplacePlan> {
    const areaIds: string[] = [];
    for (const areaId of new Set(resolved.map((r) => r.areaId))) {
      try {
        await assertAreaAccessible(this.prisma, userId, areaId);
        areaIds.push(areaId);
      } catch {
        // fica de fora: o item correspondente falha no create com a mensagem certa
      }
    }
    if (areaIds.length === 0) return { toDelete: [], keptByItem: new Map() };

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
    return { toDelete, keptByItem };
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
