import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    try {
      // Separamos a data do resto para garantir que a conversão não esmaga nada
      const { date, ...rest } = dto;

      return await this.prisma.task.create({
        data: {
          ...rest,
          date: new Date(date),
          userId: userId, // Agora temos a certeza absoluta que o ID não está vazio!
        },
        include: { area: true },
      });
    } catch (error) {
      // Se der erro, isto vai imprimir O MOTIVO EXATO no  terminal do NestJS
      console.error('ERRO PRISMA (CREATE TASK):', error);
      throw new InternalServerErrorException(
        'Erro ao criar tarefa. Verifica o terminal do backend.',
      );
    }
  }

  findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId: userId },
      include: { area: true },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: id, userId: userId },
      include: { area: true },
    });
    if (!task)
      throw new NotFoundException(`Task não encontrada ou não tens acesso.`);
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    await this.findOne(userId, id);
    const { date, ...rest } = dto;
    return this.prisma.task.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
      include: { area: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }
}
