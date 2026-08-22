import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskTypeDto } from './dto/create-task-type.dto';
import { UpdateTaskTypeDto } from './dto/update-task-type.dto';
import { CreateAcademicTaskTypeDto } from './dto/create-academic-task-type.dto';
import { UpdateAcademicTaskTypeDto } from './dto/update-academic-task-type.dto';
import { slugifyToKey } from './utils/generate-key';
import { TaskMetaCacheService } from '../common/task-meta-cache.service';

@Injectable()
export class TaskTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskMetaCache: TaskMetaCacheService,
  ) {}

  // TaskType

  findAllTaskTypes(onlyActive: boolean) {
    return this.prisma.taskType.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { order: 'asc' },
      include: { academicTaskTypes: true },
    });
  }

  async createTaskType(dto: CreateTaskTypeDto) {
    const key = await this.generateUniqueKey(dto.label, (candidate) =>
      this.prisma.taskType
        .findUnique({ where: { key: candidate } })
        .then((found) => found !== null),
    );
    const created = await this.prisma.taskType.create({
      data: { ...dto, key },
    });
    // Só invalida DEPOIS do write ter sucesso - se o create falhar (ex:
    // validação), a cache existente continua válida, não há razão para a
    // deitar fora por uma escrita que nunca aconteceu.
    this.taskMetaCache.invalidate();
    return created;
  }

  async updateTaskType(id: string, dto: UpdateTaskTypeDto) {
    await this.getTaskTypeOrThrow(id);
    // "key" nunca está no dto (nem existe no DTO) - não há risco de a
    // update tentar tocar-lhe, mesmo por engano.
    const updated = await this.prisma.taskType.update({
      where: { id },
      data: dto,
    });
    this.taskMetaCache.invalidate();
    return updated;
  }

  // Soft delete: nunca apagamos a sério. Apagar de facto partiria todas as
  // Tasks que já usam este tipo (FK), por isso só desativamos.
  async removeTaskType(id: string) {
    await this.getTaskTypeOrThrow(id);
    const removed = await this.prisma.taskType.update({
      where: { id },
      data: { isActive: false },
    });
    this.taskMetaCache.invalidate();
    return removed;
  }

  private async getTaskTypeOrThrow(id: string) {
    const taskType = await this.prisma.taskType.findUnique({ where: { id } });
    if (!taskType) throw new NotFoundException('TaskType not found.');
    return taskType;
  }

  // AcademicTaskType

  findAllAcademicTaskTypes(onlyActive: boolean) {
    return this.prisma.academicTaskType.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { order: 'asc' },
      include: { taskType: true },
    });
  }

  async createAcademicTaskType(dto: CreateAcademicTaskTypeDto) {
    const parent = await this.prisma.taskType.findUnique({
      where: { id: dto.taskTypeId },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent TaskType "${dto.taskTypeId}" does not exist.`,
      );
    }

    const key = await this.generateUniqueKey(dto.label, (candidate) =>
      this.prisma.academicTaskType
        .findUnique({ where: { key: candidate } })
        .then((found) => found !== null),
    );

    const { taskTypeId, ...rest } = dto;
    const created = await this.prisma.academicTaskType.create({
      data: { ...rest, key, taskTypeId },
      include: { taskType: true },
    });
    this.taskMetaCache.invalidate();
    return created;
  }

  async updateAcademicTaskType(id: string, dto: UpdateAcademicTaskTypeDto) {
    await this.getAcademicTaskTypeOrThrow(id);

    if (dto.taskTypeId) {
      const parent = await this.prisma.taskType.findUnique({
        where: { id: dto.taskTypeId },
      });
      if (!parent) {
        throw new BadRequestException(
          `Parent TaskType "${dto.taskTypeId}" does not exist.`,
        );
      }
    }

    const updated = await this.prisma.academicTaskType.update({
      where: { id },
      data: dto,
      include: { taskType: true },
    });
    this.taskMetaCache.invalidate();
    return updated;
  }

  async removeAcademicTaskType(id: string) {
    await this.getAcademicTaskTypeOrThrow(id);
    const removed = await this.prisma.academicTaskType.update({
      where: { id },
      data: { isActive: false },
    });
    this.taskMetaCache.invalidate();
    return removed;
  }

  private async getAcademicTaskTypeOrThrow(id: string) {
    const item = await this.prisma.academicTaskType.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('AcademicTaskType not found.');
    return item;
  }

  // Gera a key a partir do label (ver utils/generate-key.ts) e, se já
  // existir (dois tipos com nomes que dão origem à mesma key, ex: "Física"
  // e "FISICA"), acrescenta um sufixo numérico até encontrar uma livre.
  // O admin nunca vê isto acontecer - só escreve o nome.
  private async generateUniqueKey(
    label: string,
    exists: (candidate: string) => Promise<boolean>,
  ): Promise<string> {
    const base = slugifyToKey(label);
    let candidate = base;
    let suffix = 2;
    while (await exists(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}
