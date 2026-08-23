import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { slugifyToKey } from '../task-types/utils/generate-key';
import { TaskMetaCacheService } from '../common/task-meta-cache.service';

@Injectable()
export class PrioritiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskMetaCache: TaskMetaCacheService,
  ) {}

  findAll(onlyActive: boolean) {
    return this.prisma.priority.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { order: 'asc' },
    });
  }

  async create(dto: CreatePriorityDto) {
    const key = await this.generateUniqueKey(dto.label);
    const created = await this.prisma.priority.create({
      data: { ...dto, key },
    });
    // Só invalida DEPOIS do write ter sucesso - mesmo raciocínio que
    // TaskTypesService: se o create falhar, a cache existente continua
    // válida, não há razão para a deitar fora por uma escrita que nunca
    // aconteceu.
    this.taskMetaCache.invalidate();
    return created;
  }

  async update(id: string, dto: UpdatePriorityDto) {
    await this.getOrThrow(id);
    const updated = await this.prisma.priority.update({
      where: { id },
      data: dto,
    });
    this.taskMetaCache.invalidate();
    return updated;
  }

  // Soft delete: nunca apagamos a sério - partiria todas as Tasks que já
  // apontam para esta Priority (FK), por isso só desativamos, mesmo
  // padrão do TaskType.
  async remove(id: string) {
    await this.getOrThrow(id);
    const removed = await this.prisma.priority.update({
      where: { id },
      data: { isActive: false },
    });
    this.taskMetaCache.invalidate();
    return removed;
  }

  private async getOrThrow(id: string) {
    const priority = await this.prisma.priority.findUnique({ where: { id } });
    if (!priority) throw new NotFoundException('Priority not found.');
    return priority;
  }

  private async generateUniqueKey(label: string): Promise<string> {
    const base = slugifyToKey(label);
    let candidate = base;
    let suffix = 2;
    while (
      await this.prisma.priority
        .findUnique({ where: { key: candidate } })
        .then((found) => found !== null)
    ) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}
