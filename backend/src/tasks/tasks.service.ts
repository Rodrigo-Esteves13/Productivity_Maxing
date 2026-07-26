import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Difficulty, ProgressStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodsService } from '../academic-programs/periods.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ImportTasksDto } from './dto/import-tasks.dto';

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

  constructor(
    private prisma: PrismaService,
    private periodsService: PeriodsService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const { date, type, academicType, periodId, ...rest } = dto;
    const typeIds = await this.resolveTypes(type, academicType);

    // Se o cliente (frontend atual, ainda sem seletor de período) não
    // mandar periodId, usa-se o período ativo do user - é isto que garante
    // zero breaking change enquanto a UI da Fase 2 não existe. Se mandar
    // um periodId explícito, validamos posse primeiro (defesa contra IDOR,
    // mesmo padrão do resto do service).
    const resolvedPeriodId = periodId
      ? (await this.periodsService.findOwnedOrThrow(userId, periodId)).id
      : await this.periodsService.resolveActivePeriodId(userId);

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
          periodId: resolvedPeriodId,
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
        'Failed to create task. Please try again.',
      );
    }
  }

  async findAll(userId: string, periodId?: string) {
    // 'all' = vista agregada ("Ver todos os períodos") - sem filtro nenhum.
    // Omitido = usa o período ativo do user (declutter automático, é o que
    // resolve a Fase 2 sem qualquer breaking change para quem ainda chama
    // este endpoint sem saber que períodos existem). Um UUID explícito
    // passa sempre por findOwnedOrThrow - defesa contra IDOR.
    const where: { userId: string; periodId?: string } = { userId };
    if (periodId === 'all') {
      // sem filtro de periodId
    } else if (periodId) {
      where.periodId = (
        await this.periodsService.findOwnedOrThrow(userId, periodId)
      ).id;
    } else {
      where.periodId = await this.periodsService.resolveActivePeriodId(userId);
    }

    const tasks = await this.prisma.task.findMany({
      where,
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
        // Um período arquivado (semestre antigo já fechado) nunca deve
        // gerar alertas/plano do dia - ver regra de negócio da Fase 4.
        period: { isArchived: false },
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

    const { date, type, academicType, periodId, ...rest } = dto;

    // Só mexemos em periodId se vier explicitamente no PATCH - e, tal como
    // no create(), validamos sempre posse antes de aceitar (o user podia
    // tentar mover a task para um período de outro user só adivinhando o
    // UUID).
    const periodIdUpdate =
      periodId !== undefined
        ? {
            periodId: (
              await this.periodsService.findOwnedOrThrow(userId, periodId)
            ).id,
          }
        : {};

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
        ...periodIdUpdate,
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
        // Uma task esquecida de um semestre já arquivado nunca deve voltar
        // a perguntar "isto já está feito?" - ver regra de negócio da
        // Fase 4 (isto é também o que o agente Go consulta para decidir
        // bloqueios, já que corre pelo mesmo endpoint autenticado por
        // API key, ver JwtOrApiKeyAuthGuard no controller).
        period: { isArchived: false },
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

  /**
   * Bulk equivalent of update() for progressStatus only (see
   * BulkUpdateStatusDto for why it's scoped this narrowly). updateMany()
   * naturally enforces ownership via the userId in `where` - any id in
   * `ids` that isn't this user's task is just silently excluded from the
   * match, same "not found or no access" outcome as the single-task
   * path, just without a thrown error per missing id (a partial bulk
   * selection shouldn't fail the whole batch).
   *
   * completedAt is handled in two passes so the streak logic from the
   * single-task update() still holds: a task newly moving to COMPLETED
   * gets a fresh completedAt, but one already COMPLETED that's being
   * moved to another status has completedAt cleared - never do we
   * "reset" the completedAt of a task that was already COMPLETED and
   * stays that way, since it's not part of either matched batch below.
   */
  async bulkUpdateStatus(
    userId: string,
    ids: string[],
    progressStatus: ProgressStatus,
  ) {
    if (progressStatus === 'COMPLETED') {
      const result = await this.prisma.task.updateMany({
        where: { id: { in: ids }, userId, progressStatus: { not: 'COMPLETED' } },
        data: { progressStatus, completedAt: new Date() },
      });
      return { count: result.count };
    }

    const result = await this.prisma.task.updateMany({
      where: { id: { in: ids }, userId, progressStatus: 'COMPLETED' },
      data: { progressStatus, completedAt: null },
    });
    const untouched = await this.prisma.task.updateMany({
      where: { id: { in: ids }, userId, progressStatus: { not: 'COMPLETED' } },
      data: { progressStatus },
    });
    return { count: result.count + untouched.count };
  }

  /** Bulk delete - same ownership scoping as bulkUpdateStatus() above. */
  async bulkRemove(userId: string, ids: string[]) {
    const result = await this.prisma.task.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return { count: result.count };
  }

  /**
   * Excel/CSV import (see ImportTasksDto): creates one task per row.
   * Each row is validated and inserted independently and wrapped in its
   * own try/catch - a single bad row (unknown Area, invalid type key,
   * malformed date that slipped past the DTO's @IsDateString somehow)
   * fails that row only, not the whole batch. A spreadsheet with 40 good
   * rows and 2 typos should still create the 40, with the 2 reported back
   * so the user can fix and re-import just those.
   *
   * The active period is resolved once outside the loop (self-healing
   * side effects of resolveActivePeriodId - creating a default
   * program/period on first use - should only happen once per import,
   * not once per row).
   */
  async importTasks(userId: string, dto: ImportTasksDto) {
    const activePeriodId = await this.periodsService.resolveActivePeriodId(userId);

    let created = 0;
    const results: {
      row: number;
      success: boolean;
      taskId?: string;
      error?: string;
    }[] = [];

    for (let i = 0; i < dto.tasks.length; i++) {
      const row = dto.tasks[i];
      try {
        const typeIds = await this.resolveTypes(row.type, row.academicType);

        // Area is the global catalog (no owner), but a stale/garbage
        // areaId (e.g. re-importing an old export after an Area was
        // renamed/removed) shouldn't silently create an orphaned task.
        const area = await this.prisma.area.findUnique({
          where: { id: row.areaId },
        });
        if (!area) {
          throw new BadRequestException(`Area "${row.areaId}" not found.`);
        }

        const resolvedPeriodId = row.periodId
          ? (await this.periodsService.findOwnedOrThrow(userId, row.periodId))
              .id
          : activePeriodId;

        const progressStatus = row.progressStatus ?? 'ON_TRACK';
        const completedAt = progressStatus === 'COMPLETED' ? new Date() : null;

        const task = await this.prisma.task.create({
          data: {
            title: row.title,
            date: new Date(row.date),
            userId,
            areaId: area.id,
            periodId: resolvedPeriodId,
            difficulty: row.difficulty ?? 'MEDIUM',
            progressStatus,
            weightPercentage: row.weightPercentage ?? null,
            targetGrade: row.targetGrade ?? null,
            realGrade: row.realGrade ?? null,
            topics: row.topics ?? null,
            completedAt,
            ...typeIds,
          },
        });

        created++;
        results.push({ row: i + 1, success: true, taskId: task.id });
      } catch (error) {
        // BadRequestException messages here are all developer-authored,
        // user-safe strings (see resolveTypes/the Area check above) - safe
        // to forward as-is. Anything else (a raw Prisma/DB error) gets a
        // generic message instead, same "never leak internals" rule as
        // the rest of the app (see create() above).
        const message =
          error instanceof BadRequestException
            ? error.message
            : 'Unexpected error creating this task.';
        results.push({ row: i + 1, success: false, error: message });
        this.logger.warn(`Task import row ${i + 1} failed: ${message}`);
      }
    }

    return { created, failed: results.length - created, results };
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
