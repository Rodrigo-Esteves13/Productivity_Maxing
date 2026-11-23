import { assertAreaAccessible } from '../areas/area-access';
import { assertTaskOwned } from '../tasks/task-access';
import { isUniqueViolation } from '../common/prisma-errors';
import {
  MS_PER_DAY,
  MS_PER_MINUTE,
  MS_PER_SECOND,
} from '../common/time.constants';
import {
  addUtcDays,
  getLisbonNow,
  lisbonDayBounds,
  toDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { walkStreak } from './study-streak.util';
import { DAYS_PER_WEEK } from './streak-freeze.constants';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StopStudySessionDto } from './dto/stop-study-session.dto';
import { CreateManualSessionDto } from './dto/create-manual-session.dto';
import { UpdateStudySessionDto } from './dto/update-study-session.dto';
import { HeartbeatStudySessionDto } from './dto/heartbeat-study-session.dto';
import {
  aggregateDistractionStats,
  DISTRACTION_STATS_DEFAULT_DAYS,
  type DistractionStats,
} from './distraction-stats.util';
import {
  MAX_SESSION_MINUTES,
  validateSessionWindow,
} from './session-window.util';
import {
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
  HISTORY_MAX_ROWS,
} from './study-sessions.constants';
import {
  activeLisbonDaysSql,
  areaTotalsSql,
  weekdayHourTotalsSql,
  type ActiveDayRow,
  type AreaTotalRow,
  type WeekdayHourRow,
} from './study-sessions.sql';

// B-46: o heatmap tinha uma cache em memoria por utilizador (Map sem
// limite de tamanho, uma copia por instancia no Render). Saiu: a agregacao
// passou para SQL (GROUP BY no Postgres, no maximo 7x24 linhas devolvidas),
// por isso ja nao ha trabalho repetido que valha a pena guardar, e deixa de
// haver resultados diferentes entre instancias ou invalidacoes esquecidas.
const ACTIVE_SESSION_MESSAGE =
  'You already have an active study session. Stop it before starting another one.';
const NO_AREA_NAME = 'No area';

// Uma sessão "ativa" sem heartbeat há mais tempo do que isto é tratada
// como esquecida, não como a decorrer de facto - ver autoCloseIfStale()
// mais abaixo. Deliberadamente bem maior do que HEARTBEAT_INTERVAL_MS do
// frontend (60s, ver StudySessionProvider.tsx): um separador em
// background chega a ter o setInterval do heartbeat estrangulado pelo
// browser, e isto tem de tolerar perder alguns heartbeats seguidos sem
// fechar uma sessão que ainda está genuinamente a decorrer.
const STALE_SESSION_THRESHOLD_MS = 10 * 60 * 1000;

// Bloco de foco mais longo que o frontend deixa planear (MAX_FOCUS_MINUTES
// em lib/focusTimer.ts). O fim de bloco que o heartbeat traz nunca e aceite
// para alem de startedAt + isto: e o proprio utilizador a dize-lo, mas um
// valor absurdo nao pode manter uma sessao viva horas sem contacto.
const MAX_PLANNED_FOCUS_MS = 240 * MS_PER_MINUTE;
const MAX_SESSION_MS = MAX_SESSION_MINUTES * MS_PER_MINUTE;

// Só usada quando a sessão fechada automaticamente não tinha nenhuma nota
// já escrita pelo utilizador - nunca substitui uma nota real.
const AUTO_CLOSE_NOTE =
  'Auto-stopped: the app lost contact with this session (tab closed or device went to sleep).';

// Teto do contador de distracoes de uma sessao (ninguem carrega 500 vezes
// a serio; acima disto e um script).
const MAX_DISTRACTIONS_PER_SESSION = 500;

const SESSION_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  note: true,
  focusRating: true,
  isManual: true,
  distractionCount: true,
  taskId: true,
  areaId: true,
  task: { select: { id: true, title: true } },
  area: { select: { id: true, name: true, colorHex: true } },
} satisfies Prisma.StudySessionSelect;

type SessionWithRelations = Prisma.StudySessionGetPayload<{
  select: typeof SESSION_SELECT;
}>;

// Uma célula da grelha do heatmap: dia da semana (0=Domingo..6=Sábado) x
// bloco de 4h do dia (0=00h-04h, 1=04h-08h, ..., 5=20h-24h). Um grid 7x6
// em vez de 7x24 - com o volume de dados de um único utilizador, um
// heatmap por hora exata ficaria demasiado esparso para ser legível;
// blocos de 4h já mostram um padrão útil ("estudo melhor à tarde").
// Exportado: StudyPlanService precisa de mapear um minuto-do-dia exato
// para o mesmo bucket de 4h do heatmap, para preferir slots livres nas
// horas onde o user historicamente estuda melhor.
export const HOUR_BUCKET_SIZE = 4;
const HOUR_BUCKET_COUNT = 24 / HOUR_BUCKET_SIZE;

export interface HeatmapCell {
  dayOfWeek: number; // 0-6
  hourBucket: number; // 0-5
  totalMinutes: number;
  sessionCount: number;
}

// Streak freeze rules live in study-streak.util.ts (walkStreak).

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  freezesUsedTotal: number;
  activeToday: boolean;
  // true quando a streak existe (>0) mas ainda não há atividade hoje - dá
  // ao frontend um sinal para mostrar "ainda podes salvar a streak de
  // hoje" sem o backend decidir COMO mostrar isso.
  atRisk: boolean;
  // Hoje e um dia de descanso pedido (StreakFreeze): a streak nao corre risco.
  restDayToday: boolean;
}

export interface TaskPriorityRow {
  id: string;
  title: string;
  date: string;
  difficulty: string;
  weightPercentage: number | null;
  areaName: string;
}

// One row of TimeByAreaCard.tsx on the Dashboard - total study time per
// Area, across all-time finished sessions.
export interface AreaTimeBreakdown {
  areaId: string | null; // null = sessions with no resolvable Area at all
  areaName: string;
  areaColorHex: string | null;
  totalMinutes: number;
  sessionCount: number;
}

@Injectable()
export class StudySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string, dto: StartStudySessionDto) {
    // Antes de olhar para "já tens uma sessão ativa?": se essa sessão
    // ativa está parada há mais do que STALE_SESSION_THRESHOLD_MS sem
    // heartbeat, não é uma sessão a decorrer, é uma sessão esquecida -
    // fecha-se sozinha aqui, para não bloquear Rodrigo de começar uma
    // nova só porque ontem se esqueceu de parar a de ontem.
    await this.autoCloseIfStale(userId);

    // Só uma sessão ativa de cada vez por utilizador - evita sobreposições
    // que corromperiam o heatmap e o histórico (ex: começar 2 sessões em
    // 2 separadores e só parar uma).
    const active = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(ACTIVE_SESSION_MESSAGE);
    }

    const task = dto.taskId
      ? await this.assertTaskOwnership(userId, dto.taskId)
      : null;
    if (dto.areaId) {
      await this.assertAreaExists(userId, dto.areaId);
    }

    let session: Prisma.StudySessionGetPayload<{
      select: typeof SESSION_SELECT;
    }>;
    try {
      session = await this.prisma.studySession.create({
        data: {
          userId,
          taskId: dto.taskId ?? null,
          // Sem area escolhida, usa a da task (ex: "Comecar" num bloco do plano).
          areaId: dto.areaId ?? task?.areaId ?? null,
          note: dto.note ?? null,
          // Começa já com um heartbeat "de origem" - evita que uma sessão
          // parada nos primeiros segundos (antes do primeiro ping real do
          // frontend) seja lida como "sem heartbeat" por autoCloseIfStale.
          lastHeartbeatAt: new Date(),
        },
        select: SESSION_SELECT,
      });
    } catch (error) {
      // B-23: dois start em paralelo passam ambos o findFirst acima. Com o
      // indice unico parcial (userId WHERE endedAt IS NULL) o segundo falha
      // com P2002; devolve o mesmo 409 do caminho normal. Sem o indice
      // (antes da migracao) este ramo nunca corre.
      if (isUniqueViolation(error))
        throw new ConflictException(ACTIVE_SESSION_MESSAGE);
      throw error;
    }

    return this.toResponse(session);
  }

  async stop(userId: string, id: string, dto: StopStudySessionDto) {
    // where: { id, userId } - não confiar só num findFirst() prévio (defesa
    // em profundidade contra IDOR, mesmo pouco provável aqui já que
    // validamos posse antes).
    const existing = await this.prisma.studySession.findFirst({
      where: { id, userId },
      select: { id: true, startedAt: true, endedAt: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Study session not found or you don't have access.`,
      );
    }
    if (existing.endedAt) {
      throw new ConflictException('This session has already been stopped.');
    }

    // endedAt opcional: "parei de estudar as 14:32 e so agora me lembrei".
    // Validado contra o inicio real e nunca no futuro.
    // Uma sessao esquecida aberta mais de MAX_SESSION_MINUTES (heartbeats a
    // mante-la viva toda a noite) e fechada no limite em vez de dar 400 para
    // sempre: antes nunca mais se conseguia parar.
    const now = new Date();
    const endedAt = clampToMaxSession(
      existing.startedAt,
      dto.endedAt ? new Date(dto.endedAt) : now,
    );
    const problem = validateSessionWindow(existing.startedAt, endedAt, now);
    if (problem) throw new BadRequestException(problem);

    const session = await this.prisma.studySession.update({
      where: { id, userId },
      data: {
        endedAt,
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.focusRating !== undefined
          ? { focusRating: dto.focusRating }
          : {}),
      },
      select: SESSION_SELECT,
    });

    return this.toResponse(session);
  }

  /** Sessoes terminadas dos ultimos `days` dias, da mais recente para a mais antiga. */
  async history(userId: string, days?: number) {
    const safeDays = Math.min(
      Math.max(Math.trunc(days ?? HISTORY_DEFAULT_DAYS), 1),
      HISTORY_MAX_DAYS,
    );
    const since = new Date(Date.now() - safeDays * MS_PER_DAY);
    const rows = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: since } },
      select: SESSION_SELECT,
      orderBy: { startedAt: 'desc' },
      take: HISTORY_MAX_ROWS,
    });
    return rows.map((row) => this.toResponse(row));
  }

  /** Regista uma sessao que nao foi cronometrada (esqueci-me de ligar). */
  async createManual(userId: string, dto: CreateManualSessionDto) {
    const start = new Date(dto.startedAt);
    const end = new Date(dto.endedAt);
    const problem = validateSessionWindow(start, end, new Date());
    if (problem) throw new BadRequestException(problem);

    const task = dto.taskId
      ? await this.assertTaskOwnership(userId, dto.taskId)
      : null;
    if (dto.areaId) await this.assertAreaExists(userId, dto.areaId);
    await this.assertNoOverlap(userId, start, end);

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        startedAt: start,
        endedAt: end,
        taskId: dto.taskId ?? null,
        areaId: dto.areaId ?? task?.areaId ?? null,
        note: dto.note ?? null,
        focusRating: dto.focusRating ?? null,
        isManual: true,
      },
      select: SESSION_SELECT,
    });
    return this.toResponse(session);
  }

  /** Corrige tempos, nota ou concentracao de uma sessao ja terminada. */
  async update(userId: string, id: string, dto: UpdateStudySessionDto) {
    const existing = await this.prisma.studySession.findFirst({
      where: { id, userId },
      select: { id: true, startedAt: true, endedAt: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Study session not found or you don't have access.`,
      );
    }
    if (!existing.endedAt) {
      throw new ConflictException('Stop the session before editing it.');
    }

    const start = dto.startedAt ? new Date(dto.startedAt) : existing.startedAt;
    const end = dto.endedAt ? new Date(dto.endedAt) : existing.endedAt;
    const problem = validateSessionWindow(start, end, new Date());
    if (problem) throw new BadRequestException(problem);
    await this.assertNoOverlap(userId, start, end, id);

    const session = await this.prisma.studySession.update({
      where: { id, userId },
      data: {
        startedAt: start,
        endedAt: end,
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.focusRating !== undefined
          ? { focusRating: dto.focusRating }
          : {}),
      },
      select: SESSION_SELECT,
    });
    return this.toResponse(session);
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    // deleteMany com { id, userId, endedAt: not null }: nunca apaga uma
    // sessao de outro utilizador, nem uma que ainda esta a decorrer (essa
    // para-se, nao se apaga).
    const result = await this.prisma.studySession.deleteMany({
      where: { id, userId, endedAt: { not: null } },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `Study session not found, not yours, or still running.`,
      );
    }
    return { ok: true };
  }

  /**
   * Chamado pelo frontend a cada HEARTBEAT_INTERVAL_MS (ver
   * StudySessionProvider.tsx) enquanto uma sessão está ativa - é só um
   * "ainda aqui" que atualiza lastHeartbeatAt. Sempre filtrado por
   * { id, userId, endedAt: null } (nunca toca numa sessão de outro
   * utilizador nem reanima uma já fechada).
   *
   * Uma sessão já "esquecida" (sem contacto há mais do que
   * STALE_SESSION_THRESHOLD_MS) NÃO é reanimada por um heartbeat atrasado:
   * fecha-se aqui e responde 404, tal como getActive() faria. Antes o
   * resultado dependia de qual dos dois pedidos chegava primeiro ao voltar
   * de um telemóvel bloqueado. Exceção: se o frontend diz que ainda está
   * dentro de um bloco de foco planeado (plannedEndAt, mais uma margem), a
   * sessão continua - é o caso "liguei um Pomodoro e bloqueei o ecrã".
   */
  async heartbeat(
    userId: string,
    id: string,
    dto: HeartbeatStudySessionDto = {},
  ): Promise<{ ok: true }> {
    const active = await this.prisma.studySession.findFirst({
      where: { id, userId, endedAt: null },
      select: { id: true, startedAt: true, lastHeartbeatAt: true, note: true },
    });
    if (!active) {
      throw new NotFoundException(
        `Study session not found, not yours, or already stopped.`,
      );
    }

    const plannedEnd = dto.plannedEndAt
      ? clampPlannedEnd(active.startedAt, new Date(dto.plannedEndAt))
      : null;
    if (this.isStale(active, plannedEnd)) {
      await this.closeStale(userId, active);
      throw new NotFoundException(
        `Study session not found, not yours, or already stopped.`,
      );
    }

    const result = await this.prisma.studySession.updateMany({
      where: { id, userId, endedAt: null },
      data: { lastHeartbeatAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `Study session not found, not yours, or already stopped.`,
      );
    }
    return { ok: true };
  }

  /**
   * +1 distracao na sessao ATIVA do user. Atomico (increment) para dois
   * cliques seguidos nunca se perderem; limite para um script nao encher o
   * contador. Devolve o total novo.
   */
  async recordDistraction(
    userId: string,
    id: string,
  ): Promise<{ distractionCount: number }> {
    // Nada atualizado com a sessao ativa = chegou ao teto: devolve o total.
    await this.prisma.studySession.updateMany({
      where: {
        id,
        userId,
        endedAt: null,
        distractionCount: { lt: MAX_DISTRACTIONS_PER_SESSION },
      },
      data: { distractionCount: { increment: 1 } },
    });
    const session = await this.prisma.studySession.findFirst({
      where: { id, userId },
      select: { distractionCount: true, endedAt: true },
    });
    if (!session || session.endedAt !== null) {
      throw new NotFoundException(
        `Study session not found, not yours, or already stopped.`,
      );
    }
    return { distractionCount: session.distractionCount };
  }

  async getActive(userId: string) {
    // Mesma razão que em start(): uma sessão "ativa" sem heartbeat há
    // muito tempo não deve continuar a aparecer como ativa só porque
    // ninguém a foi parar - ver o comentário grande em
    // STALE_SESSION_THRESHOLD_MS acima.
    await this.autoCloseIfStale(userId);

    const session = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: SESSION_SELECT,
    });
    return session ? this.toResponse(session) : null;
  }

  /**
   * Agrega TODAS as sessões terminadas do utilizador num grid 7 (dia da
   * semana) x 6 (bloco de 4h), em hora de Lisboa. A soma por dia da semana
   * x hora de inicio corre no Postgres (weekdayHourTotalsSql, no maximo 168
   * linhas); aqui so se juntam as horas em blocos de HOUR_BUCKET_SIZE e se
   * preenche o grid completo (celulas vazias a 0).
   */
  async getHeatmap(userId: string): Promise<HeatmapCell[]> {
    const rows = await this.prisma.$queryRaw<WeekdayHourRow[]>(
      weekdayHourTotalsSql(userId),
    );

    const grid = new Map<
      string,
      { totalMinutes: number; sessionCount: number }
    >();

    for (const row of rows) {
      const hourBucket = Math.floor(Number(row.hour) / HOUR_BUCKET_SIZE);
      const key = `${Number(row.dayOfWeek)}:${hourBucket}`;
      const cell = grid.get(key) ?? { totalMinutes: 0, sessionCount: 0 };
      cell.totalMinutes += secondsToMinutes(row.totalSeconds);
      cell.sessionCount += Number(row.sessionCount);
      grid.set(key, cell);
    }

    const result: HeatmapCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < DAYS_PER_WEEK; dayOfWeek++) {
      for (let hourBucket = 0; hourBucket < HOUR_BUCKET_COUNT; hourBucket++) {
        const cell = grid.get(`${dayOfWeek}:${hourBucket}`);
        result.push({
          dayOfWeek,
          hourBucket,
          totalMinutes: cell ? Math.round(cell.totalMinutes) : 0,
          sessionCount: cell?.sessionCount ?? 0,
        });
      }
    }

    return result;
  }

  /**
   * Per-day totals for the last `days` days (today included) - powers the
   * frontend's activity heatmap/streak widget. Unlike getHeatmap() above
   * (day-of-week x hour-of-day, all-time), this is calendar-day x total
   * minutes, for a fixed recent window - a different shape for a
   * different question ("was I consistent lately" vs "when do I usually
   * study"). Bounded by the `days` window (default ~12 weeks), so it still
   * reads the window's sessions and sums them in JS.
   */
  async getDailyTotals(userId: string, days: number) {
    // Janela em dias de Lisboa (o servidor corre em UTC no Render).
    const firstDay = addUtcDays(getLisbonNow().today, -(days - 1));
    const since = lisbonDayBounds(toDateKey(firstDay)).start;

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: since } },
      select: { startedAt: true, endedAt: true },
    });

    const totalsByDay = new Map<string, number>();
    for (const session of sessions) {
      if (!session.endedAt) continue; // already filtered by the where, just for TS
      const dayKey = toLisbonDateKey(session.startedAt);
      const minutes =
        (session.endedAt.getTime() - session.startedAt.getTime()) /
        MS_PER_MINUTE;
      totalsByDay.set(
        dayKey,
        (totalsByDay.get(dayKey) ?? 0) + Math.max(0, minutes),
      );
    }

    const result: { date: string; totalMinutes: number }[] = [];
    for (let i = 0; i < days; i++) {
      const dayKey = toDateKey(addUtcDays(firstDay, i));
      result.push({
        date: dayKey,
        totalMinutes: Math.round(totalsByDay.get(dayKey) ?? 0),
      });
    }

    return result;
  }

  /**
   * Distracoes por hora do dia / Area / esforco da task, nas sessoes
   * terminadas dos ultimos `days` dias (dias de Lisboa). Ver
   * aggregateDistractionStats para as regras (amostra minima, denominadores).
   */
  async getDistractionStats(
    userId: string,
    days: number = DISTRACTION_STATS_DEFAULT_DAYS,
  ): Promise<DistractionStats> {
    const firstDay = addUtcDays(getLisbonNow().today, -(days - 1));
    const since = lisbonDayBounds(toDateKey(firstDay)).start;

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: since } },
      select: {
        startedAt: true,
        endedAt: true,
        distractionCount: true,
        area: { select: { id: true, name: true, colorHex: true } },
        task: {
          select: {
            effort: true,
            area: { select: { id: true, name: true, colorHex: true } },
          },
        },
      },
    });

    return aggregateDistractionStats(
      sessions.map((session) => ({
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        distractionCount: session.distractionCount,
        area: session.area ?? session.task?.area ?? null,
        task: session.task ? { effort: session.task.effort } : null,
      })),
      days,
    );
  }

  /**
   * Total study time per Area, across every finished session ever logged
   * - powers TimeByAreaCard.tsx on the Dashboard ("where does my study
   * time actually go"). A session's Area is resolved as
   * `session.areaId ?? session.task?.areaId` - the Focus start form lets
   * you pick a Task OR an Area OR both (see StudySessionWidget.tsx), so a
   * session started against a specific Task but with no Area explicitly
   * chosen still counts toward that Task's own course instead of being
   * silently dropped from the breakdown.
   *
   * The SUM/COUNT per Area runs in Postgres (areaTotalsSql, COALESCE of the
   * session Area and the task Area), one row per Area instead of one row
   * per session ever logged. Throttled in the controller.
   */
  async getTimeByArea(userId: string): Promise<AreaTimeBreakdown[]> {
    const rows = await this.prisma.$queryRaw<AreaTotalRow[]>(
      areaTotalsSql(userId),
    );

    return rows
      .map((row) => ({
        areaId: row.areaId ?? null,
        areaName: row.areaId ? (row.areaName ?? NO_AREA_NAME) : NO_AREA_NAME,
        areaColorHex: row.areaId ? (row.areaColorHex ?? null) : null,
        totalMinutes: Math.round(secondsToMinutes(row.totalSeconds)),
        sessionCount: Number(row.sessionCount),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  /**
   * Streak = consecutive calendar days (up to and including today) with at
   * least one finished study session, walked day by day from the first
   * ever session. Deliberately computed fresh from raw session data every
   * call: no separate "streak" table to keep in sync, the session history
   * is already the single source of truth and freezes are fully determined
   * by it (see FREEZE_EARN_INTERVAL_DAYS/FREEZE_MAX_BANKED). Postgres only
   * returns the distinct Lisbon days (activeLisbonDaysSql, sorted), one row
   * per study day instead of one per session; walkStreak stays in JS.
   *
   * Today is never treated as a "miss" even with zero activity so far -
   * the day isn't over yet. That's what `atRisk` communicates to the
   * frontend instead: "no freeze needed yet, but nothing logged today".
   */
  async getStreak(userId: string): Promise<StudyStreak> {
    const [dayRows, freezes] = await Promise.all([
      this.prisma.$queryRaw<ActiveDayRow[]>(activeLisbonDaysSql(userId)),
      // Dias de descanso pedidos (StreakFreeze): fazem ponte na streak.
      this.prisma.streakFreeze.findMany({
        where: { userId },
        select: { dateKey: true },
      }),
    ]);
    const frozenDays = new Set(freezes.map((f) => f.dateKey));
    const todayKey = toDateKey(getLisbonNow().today);
    const restDayToday = frozenDays.has(todayKey);

    // Dias de Lisboa, nao de UTC: uma sessao as 00:30 de Lisboa no verao
    // contava para o dia anterior e podia partir a sequencia. YYYY-MM-DD
    // ordena como texto, por isso o primeiro e o dia da primeira sessao.
    const dayKeys = dayRows.map((row) => row.dayKey).sort();
    const activeDays = new Set(dayKeys);

    if (activeDays.size === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        freezesAvailable: 0,
        freezesUsedTotal: 0,
        activeToday: false,
        atRisk: false,
        restDayToday,
      };
    }

    const { currentStreak, longestStreak, freezesAvailable, freezesUsedTotal } =
      walkStreak(activeDays, dayKeys[0], todayKey, frozenDays);

    return {
      currentStreak,
      longestStreak,
      freezesAvailable,
      freezesUsedTotal,
      activeToday: activeDays.has(todayKey),
      atRisk: currentStreak > 0 && !activeDays.has(todayKey) && !restDayToday,
      restDayToday,
    };
  }

  /**
   * Finds this user's active session (if any) and, when it's gone quiet
   * for longer than STALE_SESSION_THRESHOLD_MS, closes it as if it had
   * been stopped at the last moment it was actually known to be running
   * (lastHeartbeatAt, falling back to startedAt for a session that never
   * got a single heartbeat). Closing it AT that timestamp rather than
   * "now" is the whole point: it keeps the heatmap/streak/daily-totals
   * honest instead of crediting Rodrigo with however many hours passed
   * before he happened to reopen the app.
   *
   * Deliberately a plain lazy check on the two call sites that matter
   * (start, getActive) instead of a cron/scheduled job: no extra
   * infrastructure for a single-user volume where "next time the app is
   * opened" is soon enough.
   */
  private async autoCloseIfStale(userId: string): Promise<void> {
    const active = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true, startedAt: true, lastHeartbeatAt: true, note: true },
    });
    if (!active || !this.isStale(active, null)) return;
    await this.closeStale(userId, active);
  }

  // Sem contacto ha mais do que STALE_SESSION_THRESHOLD_MS e, se houver um
  // bloco planeado, ja passou o fim dele mais a mesma margem.
  private isStale(
    active: { startedAt: Date; lastHeartbeatAt: Date | null },
    plannedEnd: Date | null,
  ): boolean {
    const now = Date.now();
    const lastSeenAt = active.lastHeartbeatAt ?? active.startedAt;
    if (now - lastSeenAt.getTime() < STALE_SESSION_THRESHOLD_MS) return false;
    if (plannedEnd && now - plannedEnd.getTime() < STALE_SESSION_THRESHOLD_MS) {
      return false;
    }
    return true;
  }

  // Fecha no ultimo instante em que se sabia que a sessao estava a correr
  // (nao "agora", nem o fim do bloco planeado: esse so mantem a sessao viva),
  // nunca alem do limite de MAX_SESSION_MINUTES das outras escritas.
  private async closeStale(
    userId: string,
    active: {
      id: string;
      startedAt: Date;
      lastHeartbeatAt: Date | null;
      note: string | null;
    },
  ): Promise<void> {
    const lastSeenAt = active.lastHeartbeatAt ?? active.startedAt;
    await this.prisma.studySession.update({
      where: { id: active.id, userId },
      data: {
        endedAt: clampToMaxSession(active.startedAt, lastSeenAt),
        note: active.note ?? AUTO_CLOSE_NOTE,
      },
    });
  }

  // Duas sessoes do mesmo utilizador nao se podem sobrepor (corromperia o
  // heatmap e os totais). `ignoreId` exclui a propria sessao ao edita-la.
  private async assertNoOverlap(
    userId: string,
    start: Date,
    end: Date,
    ignoreId?: string,
  ) {
    const clash = await this.prisma.studySession.findFirst({
      where: {
        userId,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        startedAt: { lt: end },
        OR: [{ endedAt: { gt: start } }, { endedAt: null }],
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'This overlaps another study session. Adjust the times.',
      );
    }
  }

  private assertTaskOwnership(userId: string, taskId: string) {
    return assertTaskOwned(this.prisma, userId, taskId, {
      select: { id: true, areaId: true },
    });
  }

  // Area oficial OU privada deste user (ver areas/area-access.ts).
  private assertAreaExists(userId: string, areaId: string) {
    return assertAreaAccessible(this.prisma, userId, areaId);
  }

  private toResponse(session: SessionWithRelations) {
    const durationSeconds = session.endedAt
      ? Math.max(
          0,
          Math.round(
            (session.endedAt.getTime() - session.startedAt.getTime()) /
              MS_PER_SECOND,
          ),
        )
      : null;

    return { ...session, durationSeconds };
  }
}

// Segundos vindos do $queryRaw (float8, ou BigInt/Decimal se o cast faltar)
// para minutos em JS.
function secondsToMinutes(seconds: unknown): number {
  return (Number(seconds ?? 0) * MS_PER_SECOND) / MS_PER_MINUTE;
}

function clampToMaxSession(startedAt: Date, endedAt: Date): Date {
  return new Date(
    Math.min(endedAt.getTime(), startedAt.getTime() + MAX_SESSION_MS),
  );
}

// Fim de bloco dito pelo frontend: invalido ou antes do inicio = ignorado;
// nunca alem do bloco mais longo que se pode planear.
function clampPlannedEnd(startedAt: Date, plannedEnd: Date): Date | null {
  if (Number.isNaN(plannedEnd.getTime())) return null;
  if (plannedEnd.getTime() <= startedAt.getTime()) return null;
  return new Date(
    Math.min(plannedEnd.getTime(), startedAt.getTime() + MAX_PLANNED_FOCUS_MS),
  );
}
