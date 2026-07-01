import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  // Substitui pelo teu ID de user real do Prisma Studio
  private readonly testUserId = 'TEU_UUID_AQUI';

  create(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: { ...dto, date: new Date(dto.date), userId: this.testUserId },
    });
  }

  findAll() {
    return this.prisma.task.findMany({
      where: { userId: this.testUserId },
      include: { area: true }, // Corrigido de 'subject' para 'area'
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { area: true }, // Corrigido de 'subject' para 'area'
    });
    if (!task) throw new NotFoundException(`Task ${id} não encontrada`);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.findOne(id);
    const { date, ...rest } = dto;
    return this.prisma.task.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.delete({ where: { id } });
  }
}
