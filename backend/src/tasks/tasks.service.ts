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
import { DIFFICULTY_WEIGHT } from '../common/difficulty-weight.util';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import { TaskMetaCacheService } from '../common/task-meta-cache.service';

const TASK_INCLUDE = {
  area: true,
  taskType: true,
  academicType: true,
} as const;

// Automatically infer the type of a Task when it includes the relations above
type TaskWithIncludes = Prisma.TaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

// How many rows' worth of task.create() calls run in flight at once during
// importTasks(). High enough to actually speed things up over sequential,
// low enough to stay well under typical pooled-connection limits (Supabase/
// PgBouncer session mode here, see PrismaService) even if several users
// import at the same time.
const IMPORT_CREATE_CONCURRENCY = 10;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private periodsService: PeriodsService,
    private taskMetaCache: TaskMetaCacheService,
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

    const priorityScore = (t: TaskWithIncludes) =>
      t.weightPercentage ?? DIFFICULTY_WEIGHT[t.difficulty] * 10;

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
        where: {
          id: { in: ids },
          userId,
          progressStatus: { not: 'COMPLETED' },
        },
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
   * Each row is validated and inserted independently - a single bad row
   * (unknown Area, invalid type key, malformed date that slipped past the
   * DTO's @IsDateString somehow) fails that row only, not the whole batch.
   * A spreadsheet with 40 good rows and 2 typos should still create the
   * 40, with the 2 reported back so the user can fix and re-import just
   * those.
   *
   * Previously this validated AND created one row fully at a time - up to
   * 3 sequential DB round-trips per row (resolveTypes' 1-2 lookups + an
   * Area lookup) before even getting to the create, all `await`ed one
   * after another. For a 500-row import that's up to ~1500 round-trips
   * that could never overlap. Two changes fix that without changing the
   * partial-success behavior at all:
   *
   * 1. Every *lookup* (active TaskTypes, active AcademicTaskTypes, the
   *    distinct Areas referenced, the distinct owned Periods referenced)
   *    is fetched ONCE up front with `findMany({ where: { id/key: { in:
   *    [...] } } })` into in-memory Maps, then every row resolves against
   *    those Maps synchronously - zero DB calls in the per-row validation.
   * 2. The actual `task.create()` calls (the one part of this that has to
   *    stay a real DB write per row) run with bounded concurrency instead
   *    of one full await before starting the next - see
   *    runWithConcurrencyLimit in common/concurrency.util.ts.
   *
   * The active period is still resolved once outside the loop either way
   * (self-healing side effects of resolveActivePeriodId - creating a
   * default program/period on first use - should only happen once per
   * import, not once per row).
   */
  async importTasks(userId: string, dto: ImportTasksDto) {
    const rows = dto.tasks;

    const activePeriodId =
      await this.periodsService.resolveActivePeriodId(userId);

    // --- Batch-fetch every lookup this import could possibly need, once. ---
    const distinctAreaIds = [...new Set(rows.map((r) => r.areaId))];
    const distinctPeriodIds = [
      ...new Set(
        rows.map((r) => r.periodId).filter((id): id is string => !!id),
      ),
    ];

    const [taskTypes, academicTaskTypes, areas, ownedPeriods] =
      await Promise.all([
        this.prisma.taskType.findMany({ where: { isActive: true } }),
        this.prisma.academicTaskType.findMany({ where: { isActive: true } }),
        this.prisma.area.findMany({
          where: { id: { in: distinctAreaIds } },
        }),
        // Sempre chamado, mesmo com distinctPeriodIds vazio (`in: []`
        // devolve zero linhas, comportamento normal do Prisma - não é um
        // caso especial). O ramo condicional que estava aqui antes
        // (`? findMany(...) : Promise.resolve([])`) fazia o TypeScript
        // perder a inferência do tipo do tuple inteiro devolvido por
        // Promise.all (dois branches de Promise com tipos diferentes),
        // o que degradava `ownedPeriods` (e por arrasto `areas` também)
        // para `any[]` - a causa real dos 2 erros do `npm run lint`
        // ("Unsafe member access .id on an any value" /
        // "no-unsafe-assignment"). Uma query sempre-igual, sem ramo,
        // resolve isto na origem em vez de apenas silenciar o aviso.
        this.prisma.academicPeriod.findMany({
          where: {
            id: { in: distinctPeriodIds },
            program: { userId },
          },
        }),
      ]);

    const taskTypeByKey = new Map(taskTypes.map((t) => [t.key, t]));
    const academicTypeByKey = new Map(academicTaskTypes.map((a) => [a.key, a]));
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const ownedPeriodById = new Map(ownedPeriods.map((p) => [p.id, p]));

    // --- Validate every row against the Maps above - no DB calls here. ---
    type PreparedRow = {
      rowNumber: number;
      data: Prisma.TaskCreateArgs['data'];
    };
    type FailedRow = { rowNumber: number; error: string };

    const prepared: PreparedRow[] = [];
    const failed: FailedRow[] = [];

    rows.forEach((row, i) => {
      const rowNumber = i + 1;
      try {
        const typeIds = this.resolveTypesFromCache(
          taskTypeByKey,
          academicTypeByKey,
          row.type,
          row.academicType,
        );

        const area = areaById.get(row.areaId);
        if (!area) {
          throw new BadRequestException(`Area "${row.areaId}" not found.`);
        }

        let resolvedPeriodId = activePeriodId;
        if (row.periodId) {
          if (!ownedPeriodById.has(row.periodId)) {
            throw new BadRequestException(
              `Period "${row.periodId}" not found or no access.`,
            );
          }
          resolvedPeriodId = row.periodId;
        }

        const progressStatus = row.progressStatus ?? 'ON_TRACK';
        const completedAt = progressStatus === 'COMPLETED' ? new Date() : null;

        prepared.push({
          rowNumber,
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
      } catch (error) {
        const message =
          error instanceof BadRequestException
            ? error.message
            : 'Unexpected error validating this row.';
        failed.push({ rowNumber, error: message });
        this.logger.warn(`Task import row ${rowNumber} failed: ${message}`);
      }
    });

    // --- Create only the rows that passed validation, bounded-concurrent. ---
    type RowOutcome = {
      row: number;
      success: boolean;
      taskId?: string;
      error?: string;
    };

    const createOutcomes = await runWithConcurrencyLimit(
      prepared,
      IMPORT_CREATE_CONCURRENCY,
      async (item): Promise<RowOutcome> => {
        try {
          const task = await this.prisma.task.create({ data: item.data });
          return { row: item.rowNumber, success: true, taskId: task.id };
        } catch (error) {
          // Same "never leak internals" rule as create() above - a raw
          // Prisma/DB error could contain column/constraint names.
          this.logger.warn(
            `Task import row ${item.rowNumber} failed at insert: ${(error as Error).message}`,
          );
          return {
            row: item.rowNumber,
            success: false,
            error: 'Unexpected error creating this task.',
          };
        }
      },
    );

    const results: RowOutcome[] = [
      ...failed.map((f) => ({
        row: f.rowNumber,
        success: false,
        error: f.error,
      })),
      ...createOutcomes,
    ].sort((a, b) => a.row - b.row);

    const created = results.filter((r) => r.success).length;
    return { created, failed: results.length - created, results };
  }

  // Same shape for every user (this is a global catalog, not scoped to
  // anyone) and hit on every single Dashboard/Tasks page load - see the
  // waterfall fix in Dashboard.tsx/useTasksPage.ts, which made this fire
  // immediately on mount specifically because it's cheap and doesn't
  // change per-request. Caching it turns that into a DB round-trip only
  // once per TTL window (or immediately after an admin actually changes a
  // TaskType/AcademicTaskType - see TaskMetaCacheService.invalidate(),
  // called from TaskTypesService) instead of on every page load from
  // every user.
  async getMeta() {
    const cached =
      this.taskMetaCache.get<Awaited<ReturnType<typeof this.buildMeta>>>();
    if (cached) return cached;

    const meta = await this.buildMeta();
    this.taskMetaCache.set(meta);
    return meta;
  }

  private async buildMeta() {
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

  // Same validation as resolveTypes() above, but synchronous and backed by
  // pre-fetched Maps instead of a DB call per invocation - see
  // importTasks(). Any behavior difference here is a bug: this must stay
  // in lockstep with resolveTypes()'s rules (active-only, subcategory must
  // belong to the given type).
  private resolveTypesFromCache(
    taskTypeByKey: Map<string, { id: string; isActive: boolean }>,
    academicTypeByKey: Map<
      string,
      { id: string; isActive: boolean; taskTypeId: string }
    >,
    typeKey: string,
    academicTypeKey?: string,
  ) {
    const taskType = taskTypeByKey.get(typeKey);
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(
        `Task type "${typeKey}" invalid or inactive.`,
      );
    }

    if (!academicTypeKey) {
      return { taskTypeId: taskType.id, academicTypeId: null };
    }

    const academicType = academicTypeByKey.get(academicTypeKey);
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
