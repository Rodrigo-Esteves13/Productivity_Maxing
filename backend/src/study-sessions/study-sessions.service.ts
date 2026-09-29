import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StartStudySessionDto } from './dto/start-study-session.dto';
import { StopStudySessionDto } from './dto/stop-study-session.dto';

// Meio-termo entre "recalcular tudo em memória a cada pedido" (o que
// tínhamos antes - um findMany() à tabela toda do utilizador em CADA
// abertura da página Focus) e "manter uma tabela pré-agregada sincronizada
// à parte" (mais rápido, mas mais uma fonte de verdade para manter
// consistente, e complexidade a mais para o volume atual da app).
//
// Em vez disso: cache em memória por utilizador, com expiração ao fim de
// HEATMAP_CACHE_TTL_MS. Enquanto a cache for válida, devolvemos o
// resultado guardado sem tocar na BD; passado esse tempo, a próxima
// chamada recalcula e renova a entrada. Mesmo padrão já usado em
// LoggingThrottlerGuard (cache em memória, perde-se com o restart do
// processo - aceitável aqui pela mesma razão: é só para poupar trabalho
// repetido, não é a fonte de verdade).
const HEATMAP_CACHE_TTL_MS = 5 * 60 * 1000;

// Uma sessão "ativa" sem heartbeat há mais tempo do que isto é tratada
// como esquecida, não como a decorrer de facto - ver autoCloseIfStale()
// mais abaixo. Deliberadamente bem maior do que HEARTBEAT_INTERVAL_MS do
// frontend (60s, ver StudySessionProvider.tsx): um separador em
// background chega a ter o setInterval do heartbeat estrangulado pelo
// browser, e isto tem de tolerar perder alguns heartbeats seguidos sem
// fechar uma sessão que ainda está genuinamente a decorrer.
const STALE_SESSION_THRESHOLD_MS = 10 * 60 * 1000;

// Só usada quando a sessão fechada automaticamente não tinha nenhuma nota
// já escrita pelo utilizador - nunca substitui uma nota real.
const AUTO_CLOSE_NOTE =
  'Auto-stopped: the app lost contact with this session (tab closed or device went to sleep).';

const SESSION_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  note: true,
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

// Streak freeze rules: earn 1 freeze every FREEZE_EARN_INTERVAL_DAYS of
// consecutive study, banked up to FREEZE_MAX_BANKED at once. A banked
// freeze auto-covers exactly one missed day in the past (streak doesn't
// grow that day, but doesn't reset either) - the whole point is a single
// off day doesn't wipe out weeks of consistency. Deliberately NOT
// unlimited/easy to earn: if freezes were cheap the streak would stop
// meaning anything.
const FREEZE_EARN_INTERVAL_DAYS = 7;
const FREEZE_MAX_BANKED = 2;

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
  // chave = userId. Guarda o grid já calculado + o instante em que foi
  // calculado, para decidir se ainda é válido ou se é preciso recalcular.
  private readonly heatmapCache = new Map<
    string,
    { computedAt: number; data: HeatmapCell[] }
  >();

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
      throw new ConflictException(
        'You already have an active study session. Stop it before starting another one.',
      );
    }

    if (dto.taskId) {
      await this.assertTaskOwnership(userId, dto.taskId);
    }
    if (dto.areaId) {
      await this.assertAreaExists(dto.areaId);
    }

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        taskId: dto.taskId ?? null,
        areaId: dto.areaId ?? null,
        note: dto.note ?? null,
        // Começa já com um heartbeat "de origem" - evita que uma sessão
        // parada nos primeiros segundos (antes do primeiro ping real do
        // frontend) seja lida como "sem heartbeat" por autoCloseIfStale.
        lastHeartbeatAt: new Date(),
      },
      select: SESSION_SELECT,
    });

    return this.toResponse(session);
  }

  async stop(userId: string, id: string, dto: StopStudySessionDto) {
    // where: { id, userId } - não confiar só num findFirst() prévio (defesa
    // em profundidade contra IDOR, mesmo pouco provável aqui já que
    // validamos posse antes).
    const existing = await this.prisma.studySession.findFirst({
      where: { id, userId },
      select: { id: true, endedAt: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Study session not found or you don't have access.`,
      );
    }
    if (existing.endedAt) {
      throw new ConflictException('This session has already been stopped.');
    }

    const session = await this.prisma.studySession.update({
      where: { id, userId },
      data: {
        endedAt: new Date(),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      select: SESSION_SELECT,
    });

    // Esta sessão passa a contar para o heatmap - invalida a cache deste
    // utilizador em vez de esperar pelo TTL, para a próxima visita à
    // página Focus já refletir a sessão que acabou de terminar.
    this.heatmapCache.delete(userId);

    return this.toResponse(session);
  }

  /**
   * Chamado pelo frontend a cada HEARTBEAT_INTERVAL_MS (ver
   * StudySessionProvider.tsx) enquanto uma sessão está ativa - é só um
   * "ainda aqui" que atualiza lastHeartbeatAt. updateMany com
   * where: { id, userId, endedAt: null } em vez de findFirst + update
   * separados: uma única query, já protegida contra IDOR (nunca atualiza
   * uma sessão de outro utilizador) e contra reanimar uma sessão já
   * fechada por engano.
   */
  async heartbeat(userId: string, id: string): Promise<{ ok: true }> {
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
   * semana) x 6 (bloco de 4h). Feito em memória (não em SQL bruto) de
   * propósito: para o volume esperado (uma pessoa, meses de uso) isto é
   * perfeitamente rápido, e evita escrever SQL manual só para um dashboard.
   *
   * O resultado fica em cache por HEATMAP_CACHE_TTL_MS (ver constante no
   * topo do ficheiro) - a página Focus pode voltar a pedir isto várias
   * vezes seguidas (troca de separador, refresh, polling), e não faz
   * sentido re-somar todas as sessões da pessoa em cada uma dessas
   * chamadas. A cache é invalidada explicitamente em stop() assim que uma
   * sessão nova termina, por isso o TTL aqui é só uma rede de segurança
   * (ex: dois separadores abertos, um deles sem ver o stop do outro).
   *
   * Se um dia isto crescer muito (muitos utilizadores ativos em
   * simultâneo, ou histórico de anos por pessoa), o próximo passo deixa
   * de ser esta cache e passa a ser mover a agregação para SQL (groupBy
   * por extract(dow)/extract(hour) direto no Postgres).
   */
  async getHeatmap(userId: string): Promise<HeatmapCell[]> {
    const cached = this.heatmapCache.get(userId);
    if (cached && Date.now() - cached.computedAt < HEATMAP_CACHE_TTL_MS) {
      return cached.data;
    }

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });

    const grid = new Map<
      string,
      { totalMinutes: number; sessionCount: number }
    >();

    for (const session of sessions) {
      if (!session.endedAt) continue; // já filtrado pelo where, é só para o TS
      const dayOfWeek = session.startedAt.getDay();
      const hourBucket = Math.floor(
        session.startedAt.getHours() / HOUR_BUCKET_SIZE,
      );
      const minutes =
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;

      const key = `${dayOfWeek}:${hourBucket}`;
      const cell = grid.get(key) ?? { totalMinutes: 0, sessionCount: 0 };
      cell.totalMinutes += Math.max(0, minutes);
      cell.sessionCount += 1;
      grid.set(key, cell);
    }

    const result: HeatmapCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
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

    this.heatmapCache.set(userId, { computedAt: Date.now(), data: result });
    return result;
  }

  /**
   * Per-day totals for the last `days` days (today included) - powers the
   * frontend's activity heatmap/streak widget. Unlike getHeatmap() above
   * (day-of-week x hour-of-day, all-time), this is calendar-day x total
   * minutes, for a fixed recent window - a different shape for a
   * different question ("was I consistent lately" vs "when do I usually
   * study"). Not cached: the window is small (default ~12 weeks) and this
   * is only called once per Dashboard load, no need for the same
   * cache/invalidate complexity as the heatmap.
   */
  async getDailyTotals(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: since } },
      select: { startedAt: true, endedAt: true },
    });

    const totalsByDay = new Map<string, number>();
    for (const session of sessions) {
      if (!session.endedAt) continue; // already filtered by the where, just for TS
      const dayKey = session.startedAt.toISOString().slice(0, 10);
      const minutes =
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;
      totalsByDay.set(
        dayKey,
        (totalsByDay.get(dayKey) ?? 0) + Math.max(0, minutes),
      );
    }

    const result: { date: string; totalMinutes: number }[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(since);
      day.setDate(day.getDate() + i);
      const dayKey = day.toISOString().slice(0, 10);
      result.push({
        date: dayKey,
        totalMinutes: Math.round(totalsByDay.get(dayKey) ?? 0),
      });
    }

    return result;
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
   * Same "aggregate in JS from raw sessions" approach as getHeatmap()/
   * getDailyTotals() above, for the same reason: there's no stored
   * duration column to SQL-side SUM(), only startedAt/endedAt to diff.
   * Not cached (unlike getHeatmap) - only called once per Dashboard load,
   * doesn't need the same repeated-call protection.
   */
  async getTimeByArea(userId: string): Promise<AreaTimeBreakdown[]> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      select: {
        startedAt: true,
        endedAt: true,
        area: { select: { id: true, name: true, colorHex: true } },
        task: {
          select: {
            area: { select: { id: true, name: true, colorHex: true } },
          },
        },
      },
    });

    const totals = new Map<
      string,
      { name: string; colorHex: string | null; minutes: number; count: number }
    >();

    for (const session of sessions) {
      if (!session.endedAt) continue; // já filtrado pelo where, é só para o TS
      const resolvedArea = session.area ?? session.task?.area ?? null;
      const key = resolvedArea?.id ?? 'none';
      const minutes =
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;

      const entry = totals.get(key) ?? {
        name: resolvedArea?.name ?? 'No area',
        colorHex: resolvedArea?.colorHex ?? null,
        minutes: 0,
        count: 0,
      };
      entry.minutes += Math.max(0, minutes);
      entry.count += 1;
      totals.set(key, entry);
    }

    return Array.from(totals.entries())
      .map(([key, entry]) => ({
        areaId: key === 'none' ? null : key,
        areaName: entry.name,
        areaColorHex: entry.colorHex,
        totalMinutes: Math.round(entry.minutes),
        sessionCount: entry.count,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  /**
   * Streak = consecutive calendar days (up to and including today) with at
   * least one finished study session, walked day by day from the first
   * ever session. Deliberately computed fresh from raw session data every
   * call, same philosophy as getHeatmap()/getDailyTotals() above: no
   * separate "streak" table to keep in sync, the session history is
   * already the single source of truth and freezes are fully determined
   * by it (see FREEZE_EARN_INTERVAL_DAYS/FREEZE_MAX_BANKED). Only needs
   * `startedAt` per session, so this stays light even over a full history.
   *
   * Today is never treated as a "miss" even with zero activity so far -
   * the day isn't over yet. That's what `atRisk` communicates to the
   * frontend instead: "no freeze needed yet, but nothing logged today".
   */
  async getStreak(userId: string): Promise<StudyStreak> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const activeDays = new Set(
      sessions.map((s) => s.startedAt.toISOString().slice(0, 10)),
    );

    if (activeDays.size === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        freezesAvailable: 0,
        freezesUsedTotal: 0,
        activeToday: false,
        atRisk: false,
      };
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const firstDayKey = sessions[0].startedAt.toISOString().slice(0, 10);
    const firstDay = new Date(`${firstDayKey}T00:00:00.000Z`);
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const totalDays =
      Math.round((today.getTime() - firstDay.getTime()) / 86_400_000) + 1;

    let currentStreak = 0;
    let longestStreak = 0;
    let freezesAvailable = 0;
    let freezesUsedTotal = 0;

    for (let i = 0; i < totalDays; i++) {
      const day = new Date(firstDay);
      day.setUTCDate(day.getUTCDate() + i);
      const dayKey = day.toISOString().slice(0, 10);
      const isToday = dayKey === todayKey;

      if (activeDays.has(dayKey)) {
        currentStreak += 1;
        if (currentStreak % FREEZE_EARN_INTERVAL_DAYS === 0) {
          freezesAvailable = Math.min(freezesAvailable + 1, FREEZE_MAX_BANKED);
        }
      } else if (isToday) {
        // Not over yet - leave currentStreak as-is, don't spend a freeze,
        // don't reset. `atRisk` below tells the frontend the rest.
      } else if (freezesAvailable > 0) {
        freezesAvailable -= 1;
        freezesUsedTotal += 1;
        // Streak survives the gap, but a frozen day doesn't itself extend
        // the streak - only real study days do.
      } else {
        currentStreak = 0;
      }

      longestStreak = Math.max(longestStreak, currentStreak);
    }

    return {
      currentStreak,
      longestStreak,
      freezesAvailable,
      freezesUsedTotal,
      activeToday: activeDays.has(todayKey),
      atRisk: currentStreak > 0 && !activeDays.has(todayKey),
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
   * (start, getActive) instead of a cron/scheduled job - same philosophy
   * as the heatmap cache above: no extra infrastructure for a single-user
   * volume where "next time the app is opened" is soon enough.
   */
  private async autoCloseIfStale(userId: string): Promise<void> {
    const active = await this.prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true, startedAt: true, lastHeartbeatAt: true, note: true },
    });
    if (!active) return;

    const lastSeenAt = active.lastHeartbeatAt ?? active.startedAt;
    const staleForMs = Date.now() - lastSeenAt.getTime();
    if (staleForMs < STALE_SESSION_THRESHOLD_MS) return;

    await this.prisma.studySession.update({
      where: { id: active.id },
      data: {
        endedAt: lastSeenAt,
        note: active.note ?? AUTO_CLOSE_NOTE,
      },
    });
    this.heatmapCache.delete(userId);
  }

  private async assertTaskOwnership(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found or you don't have access.`);
    }
  }

  private async assertAreaExists(areaId: string) {
    // Areas são partilhadas (não têm userId no schema), por isso só
    // confirmamos que existe - não é uma questão de posse.
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true },
    });
    if (!area) {
      throw new NotFoundException(`Area not found.`);
    }
  }

  private toResponse(session: SessionWithRelations) {
    const durationSeconds = session.endedAt
      ? Math.max(
          0,
          Math.round(
            (session.endedAt.getTime() - session.startedAt.getTime()) / 1000,
          ),
        )
      : null;

    return { ...session, durationSeconds };
  }
}
