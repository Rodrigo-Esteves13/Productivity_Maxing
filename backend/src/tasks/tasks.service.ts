import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Difficulty, ProgressStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  area: true,
  taskType: true,
  academicType: true,
} as const;

// Automatically infer the type of a Task when it includes the relations above
type TaskWithIncludes = Prisma.TaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const { date, type, academicType, ...rest } = dto;
    const typeIds = await this.resolveTypes(type, academicType);

    // Se a task já nasce como COMPLETED (ex: registo retroativo), o streak
    // precisa de um completedAt real  não podemos depender só da "date"
    // (que é o prazo/alvo, não o dia em que foi de facto concluída).
    const completedAt = rest.progressStatus === 'COMPLETED' ? new Date() : null;

    try {
      const task = await this.prisma.task.create({
        data: {
          ...rest,
          date: new Date(date),
          userId, // Agora temos a certeza absoluta que o ID não está vazio!
          completedAt,
          ...typeIds,
        },
        include: TASK_INCLUDE,
      });
      return this.toResponse(task);
    } catch (error) {
      // Fica só no terminal/log do backend, nunca no corpo da resposta -
      // um erro do Prisma pode conter detalhes internos (nomes de coluna,
      // constraints) que não devem ir para o cliente.
      this.logger.error('Erro ao criar task', error as Error);
      throw new InternalServerErrorException(
        'Erro ao criar tarefa. Tenta novamente.',
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

  /**
   * Tasks com prazo hoje, ainda não concluídas, ordenadas por prioridade -
   * usado pelo widget "TodayPlan" na página Focus.
   *
   * Prioridade = weightPercentage (peso na nota final) quando existe,
   * senão a dificuldade percebida como proxy - assume-se que uma task mais
   * pesada/difícil merece ser atacada primeiro no dia. Isto é uma escolha
   * de produto razoável, não uma verdade absoluta - fica fácil de trocar
   * aqui se preferires outro critério mais tarde.
   */
  async findToday(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
        progressStatus: { not: 'COMPLETED' },
      },
      include: TASK_INCLUDE,
    });

    const difficultyWeight: Record<Difficulty, number> = {
      VERY_EASY: 1,
      EASY: 2,
      MEDIUM: 3,
      HARD: 4,
      VERY_HARD: 5,
    };

    const priorityScore = (t: TaskWithIncludes) =>
      t.weightPercentage ?? difficultyWeight[t.difficulty] * 10;

    const sorted = [...tasks].sort(
      (a, b) => priorityScore(b) - priorityScore(a),
    );

    return sorted.map((t) => this.toResponse(t));
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_INCLUDE,
    });
    if (!task)
      throw new NotFoundException(`Task not found or you don't have access.`);
    return this.toResponse(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_INCLUDE,
    });
    if (!existing)
      throw new NotFoundException(`Task not found or you don't have access.`);

    const { date, type, academicType, ...rest } = dto;

    // Só mexemos em taskType/academicType se um dos dois vier no PATCH.
    // Se só vier um dos dois, usamos o valor atual da task para o outro,
    // para não apagar sem querer uma subcategoria já definida.
    let typeIds = {};
    if (type !== undefined || academicType !== undefined) {
      const effectiveType = type ?? existing.taskType.key;
      const effectiveAcademic =
        academicType !== undefined
          ? academicType
          : (existing.academicType?.key ?? undefined);
      typeIds = await this.resolveTypes(effectiveType, effectiveAcademic);
    }

    // Gestão automática de completedAt: só é tocado quando o progressStatus
    // realmente muda de/para COMPLETED. Isto é o que torna o streak fiel
    // guardamos o momento exato da conclusão em vez de usar a "date" (prazo)
    // como proxy.
    let completedAtUpdate: { completedAt?: Date | null } = {};
    if (rest.progressStatus !== undefined) {
      const wasCompleted = existing.progressStatus === 'COMPLETED';
      const willBeCompleted = rest.progressStatus === 'COMPLETED';
      if (!wasCompleted && willBeCompleted) {
        completedAtUpdate = { completedAt: new Date() };
      } else if (wasCompleted && !willBeCompleted) {
        completedAtUpdate = { completedAt: null };
      }
      // Se já estava COMPLETED e continua COMPLETED, não tocamos
      // não queremos "reiniciar" a data de conclusão original.
    }

    // where: { id, userId } em vez de só { id } - o findFirst() acima já
    // garante que a task é do utilizador antes de chegarmos aqui, mas
    // repetir a condição de posse também no update final é defesa em
    // profundidade sem custo: mesmo que um refactor futuro remova ou
    // contorne o findFirst() de cima, isto continua sozinho a impedir um
    // IDOR (um user a editar uma task de outro só por adivinhar o UUID).
    const task = await this.prisma.task.update({
      where: { id, userId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...typeIds,
        ...completedAtUpdate,
      },
      include: TASK_INCLUDE,
    });
    return this.toResponse(task);
  }

  /**
   * Tasks que já passaram o prazo, ainda não marcadas como COMPLETED, e que
   * ainda não foram "perguntadas" hoje (lastOverdueCheckAt é null ou é de
   * um dia anterior a hoje). É a lista que alimenta o modal de "overdue
   * check-in" no frontend, uma vez por dia por task, até responderes.
   */
  async findPendingOverdueCheckins(userId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        date: { lt: new Date() },
        progressStatus: { not: 'COMPLETED' },
        OR: [
          { lastOverdueCheckAt: null },
          { lastOverdueCheckAt: { lt: startOfToday } },
        ],
      },
      include: TASK_INCLUDE,
      orderBy: { date: 'asc' },
    });

    return tasks.map((t) => this.toResponse(t));
  }

  /**
   * Regista a resposta ao prompt de overdue check-in.
   * - isCompleted true: a task passa mesmo a COMPLETED (mesma lógica de
   *   completedAt do update() normal, para o streak continuar fiável).
   * - isCompleted false: só marcamos que já perguntámos hoje - o
   *   progressStatus fica como está, e a pergunta volta a aparecer amanhã
   *   se continuar por concluir.
   */
  async confirmOverdue(userId: string, id: string, isCompleted: boolean) {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Task not found or you don't have access.`);

    const now = new Date();
    const task = await this.prisma.task.update({
      where: { id, userId },
      data: {
        lastOverdueCheckAt: now,
        ...(isCompleted
          ? { progressStatus: 'COMPLETED', completedAt: now }
          : {}),
      },
      include: TASK_INCLUDE,
    });
    return this.toResponse(task);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // Mesma razão do update() acima: where: { id, userId } em vez de só
    // { id }, para a condição de posse não depender só do findOne() prévio.
    return this.prisma.task.delete({ where: { id, userId } });
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
      progressStatuses: Object.values(ProgressStatus),
    };
  }

  // Resolve as keys ("ACADEMICO", "TRABALHO_PRATICO", ...) vindas do frontend
  // para os IDs reais na BD, e valida que existem, estão ativas, e que a
  // subcategoria académica pertence mesmo ao tipo indicado.
  private async resolveTypes(typeKey: string, academicTypeKey?: string) {
    const taskType = await this.prisma.taskType.findUnique({
      where: { key: typeKey },
    });
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(
        `Task type "${typeKey}" invalid or inactive.`,
      );
    }

    if (!academicTypeKey) {
      return { taskTypeId: taskType.id, academicTypeId: null };
    }

    const academicType = await this.prisma.academicTaskType.findUnique({
      where: { key: academicTypeKey },
    });
    if (
      !academicType ||
      !academicType.isActive ||
      academicType.taskTypeId !== taskType.id
    ) {
      throw new BadRequestException(
        `Academic subcategory "${academicTypeKey}" invalid for type "${typeKey}".`,
      );
    }

    return { taskTypeId: taskType.id, academicTypeId: academicType.id };
  }

  // Substituímos o "any" pelo tipo gerado pelo Prisma
  private toResponse(task: TaskWithIncludes) {
    const { taskType, taskTypeId, academicType, academicTypeId, ...rest } =
      task;

    // A declaração "void" marca as variáveis como lidas pelo interpretador,
    // o que previne o erro @typescript-eslint/no-unused-vars sem teres
    // de apagar os IDs da desestruturação.
    void taskTypeId;
    void academicTypeId;

    return {
      ...rest,
      type: taskType.key,
      academicType: academicType?.key ?? null,
    };
  }
}
