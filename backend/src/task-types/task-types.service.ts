import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskTypeDto } from './dto/create-task-type.dto';
import { UpdateTaskTypeDto } from './dto/update-task-type.dto';
import { CreateAcademicTaskTypeDto } from './dto/create-academic-task-type.dto';
import { UpdateAcademicTaskTypeDto } from './dto/update-academic-task-type.dto';

@Injectable()
export class TaskTypesService {
  constructor(private readonly prisma: PrismaService) {}

  // TaskType

  findAllTaskTypes(onlyActive: boolean) {
    return this.prisma.taskType.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { order: 'asc' },
      include: { academicTaskTypes: true },
    });
  }

  async createTaskType(dto: CreateTaskTypeDto) {
    const existing = await this.prisma.taskType.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `A TaskType with this key already exists: "${dto.key}".`,
      );
    }
    return this.prisma.taskType.create({ data: dto });
  }

  async updateTaskType(id: string, dto: UpdateTaskTypeDto) {
    await this.getTaskTypeOrThrow(id);
    return this.prisma.taskType.update({ where: { id }, data: dto });
  }

  // Soft delete: nunca apagamos a sério. Apagar de facto partiria todas as
  // Tasks que já usam este tipo (FK), por isso só desativamos.
  async removeTaskType(id: string) {
    await this.getTaskTypeOrThrow(id);
    return this.prisma.taskType.update({
      where: { id },
      data: { isActive: false },
    });
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
      where: { key: dto.taskTypeKey },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent TaskType "${dto.taskTypeKey}" does not exist.`,
      );
    }

    const existing = await this.prisma.academicTaskType.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `An AcademicTaskType with this key already exists: "${dto.key}".`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { taskTypeKey, ...rest } = dto;
    return this.prisma.academicTaskType.create({
      data: { ...rest, taskTypeId: parent.id },
      include: { taskType: true },
    });
  }

  async updateAcademicTaskType(id: string, dto: UpdateAcademicTaskTypeDto) {
    await this.getAcademicTaskTypeOrThrow(id);

    let taskTypeId: string | undefined;
    if (dto.taskTypeKey) {
      const parent = await this.prisma.taskType.findUnique({
        where: { key: dto.taskTypeKey },
      });
      if (!parent) {
        throw new BadRequestException(
          `Parent TaskType "${dto.taskTypeKey}" does not exist.`,
        );
      }
      taskTypeId = parent.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { taskTypeKey, ...rest } = dto;
    return this.prisma.academicTaskType.update({
      where: { id },
      data: { ...rest, ...(taskTypeId ? { taskTypeId } : {}) },
      include: { taskType: true },
    });
  }

  async removeAcademicTaskType(id: string) {
    await this.getAcademicTaskTypeOrThrow(id);
    return this.prisma.academicTaskType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async getAcademicTaskTypeOrThrow(id: string) {
    const item = await this.prisma.academicTaskType.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('AcademicTaskType not found.');
    return item;
  }
}
