import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Difficulty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = { area: true, taskType: true, academicType: true } as const;

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const { date, type, academicType, ...rest } = dto;
    const typeIds = await this.resolveTypes(type, academicType);

    try {
      const task = await this.prisma.task.create({
        data: {
          ...rest,
          date: new Date(date),
          userId, // Agora temos a certeza absoluta que o ID não está vazio!
          ...typeIds,
        },
        include: TASK_INCLUDE,
      });
      return this.toResponse(task);
    } catch (error) {
      // Se der erro, isto vai imprimir O MOTIVO EXATO no terminal do NestJS
      console.error('ERRO PRISMA (CREATE TASK):', error);
      throw new InternalServerErrorException(
        'Erro ao criar tarefa. Verifica o terminal do backend.',
      );
    }
  }

  async findAll(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      include: TASK_INCLUDE,
      orderBy: { date: 'asc' },
    });
    return tasks.map((t) => this.toResponse(t));
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException(`Task não encontrada ou não tens acesso.`);
    return this.toResponse(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_INCLUDE,
    });
    if (!existing) throw new NotFoundException(`Task não encontrada ou não tens acesso.`);

    const { date, type, academicType, ...rest } = dto;

    // Só mexemos em taskType/academicType se um dos dois vier no PATCH.
    // Se só vier um dos dois, usamos o valor atual da task para o outro,
    // para não apagar sem querer uma subcategoria já definida.
    let typeIds = {};
    if (type !== undefined || academicType !== undefined) {
      const effectiveType = type ?? existing.taskType.key;
      const effectiveAcademic =
        academicType !== undefined ? academicType : (existing.academicType?.key ?? undefined);
      typeIds = await this.resolveTypes(effectiveType, effectiveAcademic);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...typeIds,
      },
      include: TASK_INCLUDE,
    });
    return this.toResponse(task);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }

  async getMeta() {
    const [taskTypes, academicTaskTypes] = await Promise.all([
      this.prisma.taskType.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, colorHex: true },
      }),
      this.prisma.academicTaskType.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: { taskType: { select: { key: true } } },
      }),
    ]);

    return {
      taskTypes,
      academicTaskTypes: academicTaskTypes.map((a) => ({
        key: a.key,
        label: a.label,
        taskTypeKey: a.taskType.key,
      })),
      difficulties: Object.values(Difficulty),
    };
  }

  // Resolve as keys ("ACADEMICO", "TRABALHO_PRATICO", ...) vindas do frontend
  // para os IDs reais na BD, e valida que existem, estão ativas, e que a
  // subcategoria académica pertence mesmo ao tipo indicado.
  private async resolveTypes(typeKey: string, academicTypeKey?: string) {
    const taskType = await this.prisma.taskType.findUnique({ where: { key: typeKey } });
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(`Tipo de tarefa "${typeKey}" inválido ou inativo.`);
    }

    if (!academicTypeKey) {
      return { taskTypeId: taskType.id, academicTypeId: null };
    }

    const academicType = await this.prisma.academicTaskType.findUnique({
      where: { key: academicTypeKey },
    });
    if (!academicType || !academicType.isActive || academicType.taskTypeId !== taskType.id) {
      throw new BadRequestException(
        `Subcategoria académica "${academicTypeKey}" inválida para o tipo "${typeKey}".`,
      );
    }

    return { taskTypeId: taskType.id, academicTypeId: academicType.id };
  }

  // Devolve a Task no formato que o frontend já conhece: `type`/`academicType`
  // como strings simples (a key), em vez da relação/IDs internos.
  private toResponse(task: any) {
    const { taskType, taskTypeId, academicType, academicTypeId, ...rest } = task;
    return {
      ...rest,
      type: taskType.key,
      academicType: academicType?.key ?? null,
    };
  }
}

