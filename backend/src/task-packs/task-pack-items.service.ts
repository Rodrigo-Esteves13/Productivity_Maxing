import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  TaskPackSyncService,
  diffShared,
  fromItem,
} from './task-pack-sync.service';
import type { PackSyncResult } from './task-pack-sync.service';
import { findOwnPackSources, packItemFromTask } from './task-pack-source';
import { AddPackItemsDto, UpdatePackItemDto } from './dto/task-pack.dto';
import { MAX_PACK_ITEMS } from './task-packs.constants';

export interface TaskPackItemView {
  id: string;
  title: string;
  date: string;
  weightPercentage: number | null;
  areaName: string;
  /** Task do dono de onde o item veio; null = ja nao existe. */
  sourceTaskId: string | null;
}

const NO_CHANGES: PackSyncResult = { updatedItems: 0, proposalsCreated: 0 };
const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Editar o conteudo de um pacote. O codigo partilhado e a identidade dos itens
 * (id, sourceTaskId, ligacao das tasks importadas) nunca mudam.
 */
@Injectable()
export class TaskPackItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly sync: TaskPackSyncService,
  ) {}

  async list(ownerId: string, packId: string): Promise<TaskPackItemView[]> {
    const pack = await this.findOwnedOrThrow(ownerId, packId);
    return pack.items.map((i) => ({
      id: i.id,
      title: i.title,
      date: i.dueDate.toISOString(),
      weightPercentage: i.weightPercentage,
      areaName: i.areaName,
      sourceTaskId: i.sourceTaskId,
    }));
  }

  /** Itens novos no fim. Quem ja importou so os recebe se importar de novo. */
  async add(
    ownerId: string,
    packId: string,
    dto: AddPackItemsDto,
  ): Promise<TaskPackItemView[]> {
    const pack = await this.findOwnedOrThrow(ownerId, packId);
    const used = new Set(pack.items.map((i) => i.sourceTaskId));
    if (dto.taskIds.some((id) => used.has(id))) {
      throw new BadRequestException(
        'Some of those tasks are already in the pack.',
      );
    }
    if (pack.items.length + dto.taskIds.length > MAX_PACK_ITEMS) {
      throw new BadRequestException(
        `A pack can have at most ${MAX_PACK_ITEMS} tasks.`,
      );
    }
    const tasks = await findOwnPackSources(this.prisma, ownerId, dto.taskIds);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const start = Math.max(-1, ...pack.items.map((i) => i.position)) + 1;
    await this.prisma.taskPackItem.createMany({
      data: dto.taskIds.map((id, index) => ({
        packId: pack.id,
        ...packItemFromTask(byId.get(id)!, start + index),
      })),
    });
    return this.list(ownerId, packId);
  }

  /**
   * Com task de origem, a alteracao e feita nela (senao o proximo "Publicar
   * atualizacoes" desfazia-a) e depois publicada. Sem origem, muda so o item.
   * Em ambos os casos quem importou recebe um pedido para aprovar.
   */
  async update(
    ownerId: string,
    packId: string,
    itemId: string,
    dto: UpdatePackItemDto,
  ): Promise<PackSyncResult> {
    await this.findOwnedOrThrow(ownerId, packId);
    // Um item antigo sem origem e ligado primeiro, com o titulo/data atuais.
    await this.sync.linkLegacyItems(ownerId, packId);
    const pack = await this.findOwnedOrThrow(ownerId, packId);
    const item = pack.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Task pack item not found.');

    const edits = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.date !== undefined
        ? { date: new Date(dto.date).toISOString() }
        : {}),
      ...(dto.weightPercentage !== undefined
        ? { weightPercentage: dto.weightPercentage }
        : {}),
    };
    if (Object.keys(edits).length === 0) return NO_CHANGES;

    if (item.sourceTaskId && item.sourceTask?.userId === ownerId) {
      // Posse, limite de 100% de peso e datas validados pela TasksService.
      await this.tasksService.update(ownerId, item.sourceTaskId, edits, {
        countPostpone: false,
      });
      return this.sync.publishItems(ownerId, packId, [item.id]);
    }

    const current = fromItem(item);
    const next = { ...current, ...edits };
    if (next.submissionDate && dayOf(next.submissionDate) > dayOf(next.date)) {
      throw new BadRequestException(
        'The hand-in date must be on or before the presentation date.',
      );
    }
    const itemChanges = diffShared(current, next);
    if (Object.keys(itemChanges).length === 0) return NO_CHANGES;
    return this.sync.propagate(pack, [{ item, next, itemChanges }]);
  }

  /**
   * Tira o item do pacote. As tasks ja importadas ficam (a ligacao passa a
   * null) e os pedidos pendentes desse item sao apagados pela BD.
   */
  async remove(
    ownerId: string,
    packId: string,
    itemId: string,
  ): Promise<TaskPackItemView[]> {
    const pack = await this.findOwnedOrThrow(ownerId, packId);
    if (!pack.items.some((i) => i.id === itemId)) {
      throw new NotFoundException('Task pack item not found.');
    }
    if (pack.items.length === 1) {
      throw new BadRequestException(
        'A pack needs at least one task. Delete the pack instead.',
      );
    }
    await this.prisma.taskPackItem.deleteMany({
      where: { id: itemId, packId, pack: { ownerId } },
    });
    return this.list(ownerId, packId);
  }

  private async findOwnedOrThrow(ownerId: string, packId: string) {
    const pack = await this.prisma.taskPack.findFirst({
      where: { id: packId, ownerId },
      select: {
        id: true,
        name: true,
        owner: { select: { name: true } },
        items: {
          orderBy: { position: 'asc' },
          include: { sourceTask: { select: { userId: true } } },
        },
      },
    });
    if (!pack) throw new NotFoundException('Task pack not found.');
    return pack;
  }
}
