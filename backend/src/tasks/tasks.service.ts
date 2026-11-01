import { roundTo } from '../common/round.util';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  DateCertainty,
  Difficulty,
  Effort,
  ProgressStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  accessibleAreaWhere,
  assertAreaAccessible,
} from '../areas/area-access';
import { PeriodsService } from '../academic-programs/periods.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ImportTasksDto } from './dto/import-tasks.dto';
import { ConfirmOverdueDto } from './dto/confirm-overdue.dto';
import { computeCheckedAt, computeOverdueWindow } from './overdue-window.util';
import { DIFFICULTY_WEIGHT } from '../common/difficulty-weight.util';
import { runWithConcurrencyLimit } from '../common/concurrency.util';
import { TaskMetaCacheService } from '../common/task-meta-cache.service';
import { nextOccurrence } from './recurrence.util';
import { bulkRescheduleTasks } from './bulk-reschedule.util';
import {
  getLisbonNow,
  lisbonDayBounds,
  toDateKey,
} from '../common/date-key.util';
import {
  MAX_COURSE_WEIGHT_PERCENT,
  WEIGHT_EPSILON,
  assertWeightFits,
  loadUsedWeight,
} from '../grade-components/weight-budget';
import type { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { listOrPage, type ListMeta } from '../common/pagination.util';
import { TaskAttachmentsService } from './task-attachments.service';
import {
  ACTIONABLE_DEADLINE_WHERE,
  hasFirmDate,
} from '../common/task-readiness.util';

// Limite de caracteres do titulo de uma task (subtasks e revisoes criadas
// pelo servidor cortam aqui para nunca falhar a validacao ao gravar).
const TASK_TITLE_MAX_LENGTH = 200;
// Peso estimado (em %) por ponto de dificuldade quando a task nao tem peso.
const DIFFICULTY_TO_WEIGHT_PERCENT = 10;
// Campos do PATCH que nunca podem ser limpos com null (colunas obrigatórias).
const REQUIRED_TASK_FIELDS = [
  'areaId',
  'title',
  'date',
  'type',
  'difficulty',
  'progressStatus',
  'isPinned',
  'recurrenceInterval',
  'dateCertainty',
  'isBlocked',
] as const;

const TASK_INCLUDE = {
  area: true,
  taskType: true,
  academicType: true,
  priority: true,
  // Checklist da task, sempre ordenada - o frontend mostra "2/5" nos
  // cards/linhas sem pedir nada extra.
  subtasks: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  // So o numero de anexos (indicador de clipe nos cards), nunca as linhas.
  _count: { select: { attachments: true } },
} satisfies Prisma.TaskInclude;

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

// Revisões espaçadas: quantos dias depois de concluir, e duração estimada.
const SPACED_REVIEW_OFFSETS_DAYS = [1, 3, 7];
const SPACED_REVIEW_MINUTES = 20;

/**
 * A data mudou sem tocar na entrega (adiar para amanha, atualizacao de um
 * pacote...): se a entrega ficasse depois da nova data, passa para esse dia.
 */
function clampedSubmission(
  current: Date | null,
  newDate: string | undefined,
): { submissionDate?: Date } {
  if (!current || !newDate) return {};
  const presentation = new Date(newDate);
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);
  return dayOf(current) > dayOf(presentation)
    ? { submissionDate: presentation }
    : {};
}

/**
 * Entrega de um trabalho em duas fases: nunca depois da apresentacao
 * (`date`). Comparado pelo dia, para "entregar e apresentar no mesmo dia"
 * ser valido mesmo com horas diferentes.
 */
function checkedSubmissionDate(submission: string, presentation: string): Date {
  const value = new Date(submission);
  if (
    value.toISOString().slice(0, 10) >
    new Date(presentation).toISOString().slice(0, 10)
  ) {
    throw new BadRequestException(
      'The hand-in date must be on or before the presentation date.',
    );
  }
  return value;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private periodsService: PeriodsService,
    private taskMetaCache: TaskMetaCacheService,
    private taskAttachments: TaskAttachmentsService,
  ) {}

  /** periodId explicito (com posse verificada) ou o periodo ativo do user. */
  async resolvePeriodId(userId: string, periodId?: string): Promise<string> {
    return periodId
      ? (await this.periodsService.findOwnedOrThrow(userId, periodId)).id
      : this.periodsService.resolveActivePeriodId(userId);
  }

  async create(userId: string, dto: CreateTaskDto) {
    const {
      date,
      type,
      academicType,
      periodId,
      priority,
      recurrenceUntil,
      availableFrom,
      submissionDate,
      ...rest
    } = dto;
    // A Area tem de ser oficial ou privada DESTE user: o FK sozinho aceita
    // qualquer UUID existente, incluindo o de uma Area privada de outro.
    await assertAreaAccessible(this.prisma, userId, dto.areaId);
    const typeIds = await this.resolveTypes(type, academicType);
    const priorityId = await this.resolvePriorityId(priority);

    // Se o cliente (frontend atual, ainda sem seletor de período) não
    // mandar periodId, usa-se o período ativo do user - é isto que garante
    // zero breaking change enquanto a UI da Fase 2 não existe. Se mandar
    // um periodId explícito, validamos posse primeiro (defesa contra IDOR,
    // mesmo padrão do resto do service).
    const resolvedPeriodId = await this.resolvePeriodId(userId, periodId);

    // Cadeira nunca passa dos 100% (tasks + componentes de nota).
    await assertWeightFits(
      this.prisma,
      { userId, areaId: dto.areaId, periodId: resolvedPeriodId },
      dto.weightPercentage,
    );

    // Se a task já nasce como COMPLETED (ex: registo retroativo), o streak
    // precisa de um completedAt real  não podemos depender só da "date"
    // (que é o prazo/alvo, não o dia em que foi de facto concluída).
    const completedAt = rest.progressStatus === 'COMPLETED' ? new Date() : null;

    // Task nova entra sempre no fim da ordem manual, nunca a 0 (que
    // saltaria para o topo da lista de alguém) - ver comentário em
    // Task.sortOrder no schema.prisma.
    const maxSortOrder = await this.prisma.task.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

    try {
      const task = await this.prisma.task.create({
        data: {
          ...rest,
          date: new Date(date),
          userId, // Agora temos a certeza absoluta que o ID não está vazio!
          periodId: resolvedPeriodId,
          completedAt,
          priorityId,
          sortOrder,
          ...typeIds,
          ...(recurrenceUntil
            ? { recurrenceUntil: new Date(recurrenceUntil) }
            : {}),
          ...(availableFrom ? { availableFrom: new Date(availableFrom) } : {}),
          ...(submissionDate
            ? { submissionDate: checkedSubmissionDate(submissionDate, date) }
            : {}),
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

  async findAll(
    userId: string,
    periodId?: string,
    page: CursorPaginationDto = {},
    meta?: ListMeta,
    tag?: string,
  ) {
    // 'all' = vista agregada ("Ver todos os períodos") - sem filtro nenhum.
    // Omitido = usa o período ativo do user (declutter automático, é o que
    // resolve a Fase 2 sem qualquer breaking change para quem ainda chama
    // este endpoint sem saber que períodos existem). Um UUID explícito
    // passa sempre por findOwnedOrThrow - defesa contra IDOR.
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(tag ? { tags: { has: tag.trim().toLowerCase() } } : {}),
    };
    if (periodId === 'all') {
      // sem filtro de periodId
    } else if (periodId) {
      where.periodId = (
        await this.periodsService.findOwnedOrThrow(userId, periodId)
      ).id;
    } else {
      where.periodId = await this.periodsService.resolveActivePeriodId(userId);
    }

    const result = await listOrPage(
      (args) =>
        this.prisma.task.findMany({
          where,
          include: TASK_INCLUDE,
          // sortOrder primeiro: é a ordem manual (drag-and-drop no TaskGrid,
          // ver reorder() abaixo). `date` como desempate cobre tasks que
          // nunca foram arrastadas (todas com sortOrder=0 por omissão) -
          // sem isto, ficariam na ordem arbitrária em que o Postgres as
          // devolvesse. `id` fecha o desempate (obrigatório p/ cursor).
          orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      page,
      {
        meta,
        // Cursor so vale se a task existe no mesmo scope (user + periodo).
        cursorExists: async (id) =>
          !!(await this.prisma.task.findFirst({
            where: { ...where, id },
            select: { id: true },
          })),
      },
    );
    if (Array.isArray(result)) return result.map((t) => this.toResponse(t));
    return {
      items: result.items.map((t) => this.toResponse(t)),
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Aplica uma nova ordem manual (drag-and-drop no TaskGrid) a um
   * conjunto de tasks do próprio user - taskIds é a sequência completa
   * tal como veio do frontend, sortOrder de cada uma vira o seu índice
   * nessa lista. Tasks fora da lista (ex: arquivadas, escondidas da
   * grid) vão para depois delas, pela mesma ordem relativa.
   */
  async reorder(userId: string, taskIds: string[]): Promise<void> {
    const owned = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, userId },
      select: { id: true },
    });

    // Defesa contra IDOR: se algum ID não pertence a este user (ou já
    // não existe), o pedido inteiro é rejeitado - nunca aplicamos só a
    // parte "válida" em silêncio, o frontend saberia que a operação
    // falhou e o utilizador vê a lista voltar ao estado anterior.
    if (owned.length !== taskIds.length) {
      throw new BadRequestException(
        'One or more tasks in the list do not belong to you.',
      );
    }

    // As tasks fora da lista (filtro ativo, arquivadas) passam para DEPOIS
    // das reordenadas, mantendo a ordem relativa entre elas - é o que o
    // frontend mostra. Sem isto, uma escondida com sortOrder 1 ficava
    // intercalada entre as reordenadas depois de recarregar.
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { userId, id: { notIn: taskIds } },
        data: { sortOrder: { increment: taskIds.length } },
      }),
      ...taskIds.map((id, index) =>
        this.prisma.task.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    ]);
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
    // "Hoje" em Lisboa, nao no fuso do servidor (UTC no Render): entre as
    // 00:00 e a 01:00 de Lisboa no verao o servidor ainda esta no dia antes.
    const { start, end } = lisbonDayBounds(toDateKey(getLisbonNow().today));

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        // Apresenta hoje ou, num trabalho em duas fases, entrega hoje.
        OR: [
          { date: { gte: start, lt: end } },
          { submissionDate: { gte: start, lt: end } },
        ],
        progressStatus: { not: 'COMPLETED' },
        // Data por marcar/surpresa ou task bloqueada: nao e "para hoje".
        ...ACTIONABLE_DEADLINE_WHERE,
        // Um período arquivado (semestre antigo já fechado) nunca deve
        // gerar alertas/plano do dia - ver regra de negócio da Fase 4.
        period: { isArchived: false },
      },
      include: TASK_INCLUDE,
    });

    const priorityScore = (t: TaskWithIncludes) =>
      t.weightPercentage ??
      DIFFICULTY_WEIGHT[t.difficulty] * DIFFICULTY_TO_WEIGHT_PERCENT;

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

  // countPostpone=false: a data mudou por outra pessoa (atualizacao de um
  // pacote aceite), nao foi o user a adiar.
  async update(
    userId: string,
    id: string,
    dto: UpdateTaskDto,
    { countPostpone = true }: { countPostpone?: boolean } = {},
  ) {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_INCLUDE,
    });
    if (!existing)
      throw new NotFoundException(`Task not found or you don't have access.`);

    const {
      date,
      type,
      academicType,
      periodId,
      priority,
      recurrenceUntil,
      availableFrom,
      submissionDate,
      ...rest
    } = dto;

    // null no PATCH = "limpar o campo" (o formulário de edição manda null
    // para campos esvaziados). Só faz sentido em colunas opcionais: nas
    // obrigatórias devolvemos 400 em vez de deixar o Prisma rebentar (500).
    const clearedRequired = REQUIRED_TASK_FIELDS.filter(
      (key) => (dto as Record<string, unknown>)[key] === null,
    );
    if (clearedRequired.length > 0) {
      throw new BadRequestException(
        `These fields cannot be empty: ${clearedRequired.join(', ')}.`,
      );
    }

    // Mesmo padrão condicional que periodIdUpdate/typeIds acima: só mexe
    // em priorityId se `priority` vier explicitamente no PATCH. Sem isto,
    // um PATCH que só muda o título, por exemplo, ia (por causa do
    // `...rest` do spread) tentar reescrever priorityId com `undefined`
    // sempre que o campo não fosse enviado - o Prisma trata um campo
    // ausente no objeto `data` como "não mexer", mas só porque este bloco
    // o retira explicitamente do objeto antes disso importar.
    // `priority: ''` ou `null` (opção "Sem prioridade" do formulário) limpa
    // a prioridade; antes caía em undefined e o valor antigo ficava.
    const priorityIdUpdate =
      priority !== undefined
        ? {
            priorityId: priority
              ? await this.resolvePriorityId(priority)
              : null,
          }
        : {};

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

    // Mudar de Area: mesma regra do create() (oficial ou minha).
    if (rest.areaId !== undefined && rest.areaId !== existing.areaId) {
      await assertAreaAccessible(this.prisma, userId, rest.areaId);
    }

    // Peso: so se valida quando sobe, ou quando a task muda de cadeira/
    // periodo - editar o titulo de uma task numa cadeira ja cheia nao pode
    // falhar por causa de pesos antigos.
    // null = o user limpou o peso (nada a validar).
    const effectiveWeight =
      rest.weightPercentage !== undefined
        ? rest.weightPercentage
        : existing.weightPercentage;
    const newPeriodId =
      'periodId' in periodIdUpdate ? periodIdUpdate.periodId : undefined;
    const movedScope =
      (rest.areaId !== undefined && rest.areaId !== existing.areaId) ||
      (newPeriodId !== undefined && newPeriodId !== existing.periodId);
    const weightIncreased =
      rest.weightPercentage !== undefined &&
      rest.weightPercentage !== null &&
      rest.weightPercentage > (existing.weightPercentage ?? 0);
    if (weightIncreased || (movedScope && effectiveWeight)) {
      await assertWeightFits(
        this.prisma,
        {
          userId,
          areaId: rest.areaId ?? existing.areaId,
          periodId: newPeriodId ?? existing.periodId,
          excludeTaskId: id,
        },
        effectiveWeight,
      );
    }

    // Só mexemos em taskType/academicType se um dos dois vier no PATCH.
    // Se só vier um dos dois, usamos o valor atual da task para o outro,
    // para não apagar sem querer uma subcategoria já definida. Exceções:
    // `academicType: null`/'' limpa a subcategoria, e se o tipo MUDA a
    // subcategoria antiga nunca é reaproveitada (pertence ao tipo antigo e
    // o resolveTypes rejeitava a troca com 400).
    let typeIds = {};
    if (type !== undefined || academicType !== undefined) {
      const effectiveType = type ?? existing.taskType.key;
      const typeChanged = effectiveType !== existing.taskType.key;
      const effectiveAcademic =
        academicType !== undefined
          ? (academicType ?? undefined)
          : typeChanged
            ? undefined
            : (existing.academicType?.key ?? undefined);
      typeIds = await this.resolveTypes(effectiveType, effectiveAcademic);
    }

    // Gestão automática de completedAt: só é tocado quando o progressStatus
    // realmente muda de/para COMPLETED. Isto é o que torna o streak fiel
    // guardamos o momento exato da conclusão em vez de usar a "date" (prazo)
    // como proxy.
    let completedAtUpdate: {
      completedAt?: Date | null;
      onTime?: null;
      submissionOnTime?: null;
    } = {};
    let justCompleted = false;
    if (rest.progressStatus !== undefined) {
      const wasCompleted = existing.progressStatus === 'COMPLETED';
      const willBeCompleted = rest.progressStatus === 'COMPLETED';
      if (!wasCompleted && willBeCompleted) {
        completedAtUpdate = { completedAt: new Date() };
        justCompleted = true;
      } else if (wasCompleted && !willBeCompleted) {
        // Reaberta: a resposta "acabaste a tempo?" deixa de valer e volta a
        // ser perguntada quando se concluir de novo.
        completedAtUpdate = {
          completedAt: null,
          onTime: null,
          submissionOnTime: null,
        };
      }
      // Se já estava COMPLETED e continua COMPLETED, não tocamos
      // não queremos "reiniciar" a data de conclusão original.
    }

    // "Adiada" = a nova data é MAIS TARDE que a que já lá estava. Uma
    // task movida para uma data mais cedo (raro, mas acontece ao corrigir
    // um erro de digitação) não conta - isto é uma contagem histórica de
    // procrastinação, não "a data mudou". Comparação por getTime() em vez
    // de string, para não depender do formato exato que o date-string do
    // DTO vier a assumir.
    let postponedCountUpdate: { postponedCount?: { increment: number } } = {};
    // Mexer no palpite de uma data por marcar/surpresa nao e adiar.
    if (date && countPostpone && hasFirmDate(existing.dateCertainty)) {
      const newDate = new Date(date);
      if (newDate.getTime() > existing.date.getTime()) {
        postponedCountUpdate = { postponedCount: { increment: 1 } };
      }
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
        ...priorityIdUpdate,
        ...postponedCountUpdate,
        // undefined = não mexe; null = tira o fim da série.
        ...(recurrenceUntil !== undefined
          ? {
              recurrenceUntil: recurrenceUntil
                ? new Date(recurrenceUntil)
                : null,
            }
          : {}),
        // undefined = não mexe; null = já está disponível.
        ...(availableFrom !== undefined
          ? { availableFrom: availableFrom ? new Date(availableFrom) : null }
          : {}),
        // undefined = não mexe; null = volta a ser uma so fase.
        ...(submissionDate !== undefined
          ? {
              submissionDate: submissionDate
                ? checkedSubmissionDate(
                    submissionDate,
                    date ?? existing.date.toISOString(),
                  )
                : null,
            }
          : clampedSubmission(existing.submissionDate, date)),
      },
      include: TASK_INCLUDE,
    });

    // Acabou de passar a COMPLETED: próxima ocorrência (se repete) e
    // revisões espaçadas (se o user ativou). As tasks novas vão na resposta
    // para o frontend as mostrar sem recarregar.
    const spawnedTasks = justCompleted
      ? await this.spawnFollowUps(userId, task)
      : [];
    return {
      ...this.toResponse(task),
      ...(spawnedTasks.length > 0 ? { spawnedTasks } : {}),
    };
  }

  /**
   * Promove um passo da checklist a task própria: herda Area, tipo, período
   * e prazo da task-mãe (fica sem peso, para o user ajustar), e o passo é
   * removido da checklist. Tudo numa transação.
   */
  async createFromSubtask(userId: string, taskId: string, subtaskId: string) {
    const parent = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!parent) throw new NotFoundException('Task not found.');
    const subtask = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!subtask) throw new NotFoundException('Subtask not found.');

    const maxSortOrder = await this.prisma.task.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const [created] = await this.prisma.$transaction([
      this.prisma.task.create({
        data: {
          userId,
          areaId: parent.areaId,
          title: subtask.title.slice(0, TASK_TITLE_MAX_LENGTH),
          date: parent.date,
          // A data vem da task-mae, por isso a certeza sobre ela tambem.
          dateCertainty: parent.dateCertainty,
          sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
          taskTypeId: parent.taskTypeId,
          academicTypeId: parent.academicTypeId,
          periodId: parent.periodId,
          difficulty: parent.difficulty,
          priorityId: parent.priorityId,
          // Se o passo já estava feito, a task nasce concluída.
          ...(subtask.isDone
            ? { progressStatus: 'COMPLETED' as const, completedAt: new Date() }
            : {}),
        },
        include: TASK_INCLUDE,
      }),
      this.prisma.subtask.delete({ where: { id: subtask.id } }),
    ]);
    return this.toResponse(created);
  }

  /**
   * Tasks criadas automaticamente quando uma task é concluída. Nunca lança:
   * a conclusão já foi gravada e não deve falhar por causa disto.
   */
  private async spawnFollowUps(userId: string, task: TaskWithIncludes) {
    const spawned: ReturnType<TasksService['toResponse']>[] = [];
    try {
      const next = await this.spawnNextRecurrence(userId, task);
      if (next) spawned.push(next);
      spawned.push(...(await this.spawnSpacedReviews(userId, task)));
    } catch (error) {
      this.logger.error('Erro ao criar tasks automáticas', error as Error);
    }
    return spawned;
  }

  private async spawnNextRecurrence(userId: string, task: TaskWithIncludes) {
    if (!task.recurrenceFrequency) return null;

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const nextDate = nextOccurrence(
      task.date,
      task.recurrenceFrequency,
      task.recurrenceInterval,
      startOfToday,
      task.recurrenceUntil,
    );
    if (!nextDate) return null;

    // Concluir -> reabrir -> concluir outra vez não pode duplicar a próxima.
    const duplicate = await this.prisma.task.findFirst({
      where: {
        userId,
        title: task.title,
        date: nextDate,
        areaId: task.areaId,
        recurrenceFrequency: { not: null },
      },
      select: { id: true },
    });
    if (duplicate) return null;

    const maxSortOrder = await this.prisma.task.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.task.create({
      data: {
        userId,
        areaId: task.areaId,
        title: task.title,
        date: nextDate,
        isPinned: task.isPinned,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        taskTypeId: task.taskTypeId,
        academicTypeId: task.academicTypeId,
        topics: task.topics,
        periodId: task.periodId,
        weightPercentage: task.weightPercentage,
        difficulty: task.difficulty,
        // O esforco repete-se; a certeza da data e o bloqueio nao (a proxima
        // ocorrencia tem data calculada e comeca disponivel).
        effort: task.effort,
        priorityId: task.priorityId,
        referenceLink: task.referenceLink,
        estimatedMinutes: task.estimatedMinutes,
        calendarDurationMinutes: task.calendarDurationMinutes,
        recurrenceFrequency: task.recurrenceFrequency,
        recurrenceInterval: task.recurrenceInterval,
        recurrenceUntil: task.recurrenceUntil,
        // Duas fases: a entrega anda o mesmo que a data (mesma antecedência).
        ...(task.submissionDate
          ? {
              submissionDate: new Date(
                task.submissionDate.getTime() +
                  (nextDate.getTime() - task.date.getTime()),
              ),
            }
          : {}),
        // notas e notas finais são desta ocorrência; a checklist volta
        // toda por fazer.
        subtasks: {
          create: task.subtasks.map((s, index) => ({
            title: s.title,
            sortOrder: index,
          })),
        },
      },
      include: TASK_INCLUDE,
    });
    return this.toResponse(created);
  }

  // Revisões leves a +1/+3/+7 dias depois de concluir uma task académica
  // que NÃO é evento (testes/exames não se "revêem" depois de feitos).
  private async spawnSpacedReviews(userId: string, task: TaskWithIncludes) {
    if (task.spacedReviewOfTaskId) return [];
    if (!task.academicTypeId || task.academicType?.isEvent) return [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { spacedReviewsEnabled: true },
    });
    if (!user?.spacedReviewsEnabled) return [];

    const already = await this.prisma.task.count({
      where: { userId, spacedReviewOfTaskId: task.id },
    });
    if (already > 0) return [];

    const maxSortOrder = await this.prisma.task.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const baseOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const created = await this.prisma.$transaction(
      SPACED_REVIEW_OFFSETS_DAYS.map((offset, index) => {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + offset);
        return this.prisma.task.create({
          data: {
            userId,
            areaId: task.areaId,
            title: `Review: ${task.title}`.slice(0, TASK_TITLE_MAX_LENGTH),
            date,
            sortOrder: baseOrder + index,
            taskTypeId: task.taskTypeId,
            academicTypeId: task.academicTypeId,
            topics: task.topics,
            periodId: task.periodId,
            difficulty: Difficulty.VERY_EASY,
            estimatedMinutes: SPACED_REVIEW_MINUTES,
            spacedReviewOfTaskId: task.id,
          },
          include: TASK_INCLUDE,
        });
      }),
    );
    return created.map((t) => this.toResponse(t));
  }

  /**
   * Tasks que já passaram o prazo, ainda não marcadas como COMPLETED, e que
   * ainda não foram "perguntadas" hoje (lastOverdueCheckAt é null ou é de
   * um dia anterior a hoje). É a lista que alimenta o modal de "overdue
   * check-in" no frontend, uma vez por dia por task, até responderes.
   */
  async findPendingOverdueCheckins(userId: string) {
    const { startOfToday, overdueCutoff } = computeOverdueWindow(new Date());

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        date: { lt: overdueCutoff },
        progressStatus: { not: 'COMPLETED' },
        // Sem prazo real (por marcar/surpresa) ou bloqueada: nunca atrasada.
        ...ACTIONABLE_DEADLINE_WHERE,
        // Testes/exames (isEvent) nao sao entregas: ninguem "marca como feito"
        // no proprio dia, por isso nunca geram a pergunta de atraso.
        NOT: { academicType: { isEvent: true } },
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
   *   completedAt do update() normal, para o streak continuar fiável), e
   *   guarda a nota se vier (so quando concluida).
   * - isCompleted false: só marcamos que já perguntámos - o progressStatus
   *   fica como está. Por omissão a pergunta volta amanhã; com snoozeDays
   *   só volta passados esses dias.
   *
   * Adiar N dias grava lastOverdueCheckAt no futuro (agora + N-1 dias): a
   * query de findPendingOverdueCheckins só inclui tasks cuja marca seja
   * anterior ao início de hoje, por isso uma marca futura esconde-a até lá.
   */
  async confirmOverdue(userId: string, id: string, dto: ConfirmOverdueDto) {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Task not found or you don't have access.`);

    const now = new Date();
    const checkedAt = computeCheckedAt(
      now,
      dto.isCompleted ? 0 : (dto.snoozeDays ?? 0),
    );

    const task = await this.prisma.task.update({
      where: { id, userId },
      data: {
        lastOverdueCheckAt: checkedAt,
        ...(dto.isCompleted
          ? {
              progressStatus: 'COMPLETED',
              completedAt: now,
              ...(dto.realGrade !== undefined
                ? { realGrade: dto.realGrade }
                : {}),
            }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    // Concluir pelo check-in tem de fazer o mesmo que concluir pelo PATCH
    // normal: próxima ocorrência (se repete) e revisões espaçadas. Sem isto
    // a série acabava em silêncio (as recorrentes são as que mais atrasam).
    const justCompleted =
      dto.isCompleted && existing.progressStatus !== 'COMPLETED';
    const spawnedTasks = justCompleted
      ? await this.spawnFollowUps(userId, task)
      : [];
    return {
      ...this.toResponse(task),
      ...(spawnedTasks.length > 0 ? { spawnedTasks } : {}),
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // O cascade apaga as linhas dos anexos, nao os ficheiros no bucket.
    await this.taskAttachments.removeFilesForTasks(userId, [id]);
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
      data: {
        progressStatus,
        completedAt: null,
        onTime: null,
        submissionOnTime: null,
      },
    });
    const untouched = await this.prisma.task.updateMany({
      where: { id: { in: ids }, userId, progressStatus: { not: 'COMPLETED' } },
      data: { progressStatus },
    });
    return { count: result.count + untouched.count };
  }

  /**
   * Bulk set/clear effort. Ownership via userId in `where`: ids of other
   * users simply do not match (same outcome as bulkUpdateStatus).
   */
  async bulkUpdateEffort(userId: string, ids: string[], effort: Effort | null) {
    const result = await this.prisma.task.updateMany({
      where: { id: { in: ids }, userId },
      data: { effort },
    });
    return { count: result.count };
  }

  /** Bulk reschedule - ver bulkRescheduleTasks (mesma regra de postponedCount do update()). */
  bulkReschedule(userId: string, ids: string[], date: Date) {
    return bulkRescheduleTasks(this.prisma, userId, ids, date);
  }

  /** Bulk delete - same ownership scoping as bulkUpdateStatus() above. */
  async bulkRemove(userId: string, ids: string[]) {
    // removeFilesForTasks filtra por userId: ids de outra pessoa nao apagam nada.
    await this.taskAttachments.removeFilesForTasks(userId, ids);
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
        // Só Areas acessíveis a este user: uma Area privada de outro user
        // fica fora do Map e a linha falha com "not found" (ver abaixo).
        this.prisma.area.findMany({
          where: {
            id: { in: distinctAreaIds },
            ...accessibleAreaWhere(userId),
          },
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

    // Orcamento de peso (100% por cadeira+periodo) ja usado, carregado uma
    // vez por par; cada linha aceite desconta do que sobra.
    const budgetKey = (areaId: string, periodId: string | null) =>
      `${areaId}|${periodId ?? ''}`;
    const budgetPairs = new Map<
      string,
      { areaId: string; periodId: string | null }
    >();
    for (const row of rows) {
      const periodId = row.periodId ?? activePeriodId ?? null;
      budgetPairs.set(budgetKey(row.areaId, periodId), {
        areaId: row.areaId,
        periodId,
      });
    }
    const remainingWeight = new Map<string, number>();
    await Promise.all(
      [...budgetPairs.entries()].map(async ([key, pair]) => {
        const used = await loadUsedWeight(this.prisma, { userId, ...pair });
        remainingWeight.set(key, MAX_COURSE_WEIGHT_PERCENT - used);
      }),
    );

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

        if (row.weightPercentage) {
          const key = budgetKey(area.id, resolvedPeriodId ?? null);
          const left = remainingWeight.get(key) ?? MAX_COURSE_WEIGHT_PERCENT;
          if (row.weightPercentage > left + WEIGHT_EPSILON) {
            throw new BadRequestException(
              `This course only has ${Math.max(0, roundTo(left))}% of the final grade left.`,
            );
          }
          remainingWeight.set(key, left - row.weightPercentage);
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
            effort: row.effort ?? null,
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
    const [taskTypes, academicTaskTypes, priorities] = await Promise.all([
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
      // Já não é Object.values(Priority) - deixou de ser um enum, é um
      // catálogo editável pelo admin (ver model Priority/PrioritiesModule).
      // Mesma shape que taskTypes acima (key/label/colorHex), de propósito:
      // o frontend trata as duas listas da mesma forma (PriorityBadge usa
      // colorHex tal como as badges de TaskType).
      this.prisma.priority.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, colorHex: true },
      }),
    ]);

    return {
      taskTypes,
      academicTaskTypes: academicTaskTypes.map((a) => ({
        key: a.key,
        label: a.label,
        taskTypeKey: a.taskType.key,
        isEvent: a.isEvent,
      })),
      difficulties: Object.values(Difficulty),
      efforts: Object.values(Effort),
      dateCertainties: Object.values(DateCertainty),
      priorities,
      progressStatuses: Object.values(ProgressStatus),
    };
  }

  // Resolve a key de Priority ("LOW", "HIGH", ou qualquer key nova que o
  // admin venha a criar em /admin/priorities) para o id real na BD. Mesmo
  // espírito do resolveTypes() logo abaixo, mas mais simples: sem
  // hierarquia pai/filho para validar, e o campo é opcional (ver comentário
  // em priorityId no schema.prisma) - omitido ou string vazia = sem
  // priority definida, undefined passa direto para o Prisma como "não
  // mexer neste campo".
  private async resolvePriorityId(
    priorityKey: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (!priorityKey) return undefined;

    const priority = await this.prisma.priority.findUnique({
      where: { key: priorityKey },
    });
    if (!priority || !priority.isActive) {
      throw new BadRequestException(
        `Priority "${priorityKey}" invalid or inactive.`,
      );
    }
    return priority.id;
  }

  // Resolve as keys ("ACADEMICO", "TRABALHO_PRATICO", ...) vindas do frontend
  // para os IDs reais na BD, e valida que existem, estão ativas, e que a
  // subcategoria académica pertence mesmo ao tipo indicado.
  private async resolveTypes(typeKey: string, academicTypeKey?: string | null) {
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
    const {
      taskType,
      taskTypeId,
      academicType,
      academicTypeId,
      priority,
      priorityId,
      _count,
      ...rest
    } = task;

    // A declaração "void" marca as variáveis como lidas pelo interpretador,
    // o que previne o erro @typescript-eslint/no-unused-vars sem teres
    // de apagar os IDs da desestruturação.
    void taskTypeId;
    void academicTypeId;
    void priorityId;

    return {
      ...rest,
      attachmentCount: _count?.attachments ?? 0,
      type: taskType.key,
      academicType: academicType?.key ?? null,
      // Tipos de data fixa (testes, exames): o momento em que se marca como
      // feito nunca conta como atraso (ver wasCompletedOnTime no frontend).
      academicTypeIsEvent: academicType?.isEvent ?? false,
      // priority.key mantém a mesma forma de string que o frontend já
      // usava com o enum antigo (values.priority etc.) - zero mudança
      // nos formulários. colorHex vai à parte para a PriorityBadge não
      // precisar de repetir a lista de cores localmente, mesmo raciocínio
      // que levou taskType a já incluir colorHex.
      priority: priority?.key ?? null,
      priorityLabel: priority?.label ?? null,
      priorityColorHex: priority?.colorHex ?? null,
      // Ordem definida em /admin/priorities (menor = mais prioritário, mesma
      // convenção do resto dos catálogos) - null para tasks sem prioridade,
      // usado pelo modo de ordenação "Priority" em Tasks.tsx.
      priorityOrder: priority?.order ?? null,
    };
  }
}
