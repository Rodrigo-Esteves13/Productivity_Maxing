import { calendarTitle } from '../../common/task-readiness.util';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { WorkShiftsService } from '../../work-shifts/work-shifts.service';
import { StudyPlanService } from '../../study-plan/study-plan.service';
import {
  addUtcDays,
  getLisbonNow,
  toDateKey,
} from '../../common/date-key.util';
import { buildDesiredEvents } from '../schedule-sync.builder';
import { ItineraryService } from '../../schedule/itinerary.service';
import { flattenItinerary } from '../../schedule/itinerary.builder';
import {
  buildIcsFeed,
  lisbonWallClockToUtc,
  type FeedEvent,
} from './ics-feed.builder';
import { MS_PER_MINUTE } from '../../common/time.constants';

// Janela do feed: um pouco do passado (para a semana atual ficar completa) e
// ~2 meses para a frente. 7 + 55 = 62 dias, o máximo que o expandRange dos
// turnos aceita (MAX_RANGE_DAYS).
const PAST_DAYS = 7;
const FUTURE_DAYS = 54;
// O plano de estudo só se calcula para poucos dias (mais é ruído e caro).
const STUDY_PLAN_DAYS = 14;
// Tasks sem hora: a app guarda "dia" como meia-noite UTC.
const DEFAULT_TASK_MINUTES = 60;
// Clientes de calendário repetem o pedido de hora a hora ou mais; esta cache
// em memória evita refazer ~6 queries se o mesmo link for pedido em rajada.
const FEED_CACHE_TTL_MS = 60_000;

interface CachedFeed {
  expiresAt: number;
  body: string;
}

// O que o feed inclui. 'all' = tudo (aulas, turnos, viagens, estudo e
// tasks); 'tasks' = so os prazos das tasks, para quem nao quer o horario
// duplicado no calendario. Vem do URL (?only=tasks), nunca da BD.
export const FEED_SCOPES = ['all', 'tasks'] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

export function parseFeedScope(value: unknown): FeedScope {
  return FEED_SCOPES.find((scope) => scope === value) ?? 'all';
}

export interface CalendarFeedStatus {
  enabled: boolean;
  token: string | null;
}

@Injectable()
export class CalendarFeedService {
  private readonly logger = new Logger(CalendarFeedService.name);
  private readonly cache = new Map<string, CachedFeed>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly workShiftsService: WorkShiftsService,
    private readonly studyPlanService: StudyPlanService,
    private readonly itineraryService: ItineraryService,
  ) {}

  // ---------------------------------------------------------------- gestão

  async getStatus(userId: string): Promise<CalendarFeedStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarFeedToken: true },
    });
    return {
      enabled: user.calendarFeedToken !== null,
      token: user.calendarFeedToken,
    };
  }

  /** Cria o link, ou RODA-O (o antigo deixa de funcionar de imediato). */
  async enableOrRotate(userId: string): Promise<CalendarFeedStatus> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarFeedToken: true },
    });
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarFeedToken: token },
    });
    if (previous.calendarFeedToken) {
      this.forgetToken(previous.calendarFeedToken);
    }
    return { enabled: true, token };
  }

  async disable(userId: string): Promise<CalendarFeedStatus> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarFeedToken: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarFeedToken: null },
    });
    if (previous.calendarFeedToken) {
      this.forgetToken(previous.calendarFeedToken);
    }
    return { enabled: false, token: null };
  }

  // ---------------------------------------------------------- feed público

  /**
   * Texto .ics para um token. 404 (nunca 401/403) para token desconhecido,
   * revogado ou de uma conta bloqueada: não confirma a ninguém que um token
   * "quase certo" existiu.
   */
  async buildFeedForToken(
    token: string,
    scope: FeedScope = 'all',
  ): Promise<string> {
    // Tokens válidos são sempre 64 hex - rejeita lixo sem tocar na BD.
    if (!/^[0-9a-f]{64}$/.test(token)) throw new NotFoundException();

    const cacheKey = `${token}:${scope}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.body;

    const user = await this.prisma.user.findUnique({
      where: { calendarFeedToken: token },
      select: { id: true, status: true },
    });
    if (!user || user.status === UserStatus.BANNED) {
      throw new NotFoundException();
    }

    const { today } = getLisbonNow();
    const rangeStart = addUtcDays(today, -PAST_DAYS);
    const rangeEnd = addUtcDays(today, FUTURE_DAYS);

    const [events, tasks] = await Promise.all([
      scope === 'tasks'
        ? Promise.resolve<FeedEvent[]>([])
        : this.buildScheduleEvents(user.id, rangeStart, rangeEnd),
      this.prisma.task.findMany({
        where: {
          userId: user.id,
          progressStatus: { not: 'COMPLETED' },
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: {
          id: true,
          title: true,
          date: true,
          dateCertainty: true,
          topics: true,
          calendarDurationMinutes: true,
          area: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    for (const task of tasks) {
      const description = [
        task.area?.name ? `Area: ${task.area.name}` : null,
        task.topics ? `Topics: ${task.topics}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');

      const isDateOnly =
        task.date.getUTCHours() === 0 &&
        task.date.getUTCMinutes() === 0 &&
        task.date.getUTCSeconds() === 0;

      const base = {
        uid: `task:${task.id}@productivitymaxing`,
        title: calendarTitle(task.title, task.dateCertainty),
        description: description || null,
        category: 'task',
      };

      if (isDateOnly) {
        events.push({ ...base, allDayDate: toDateKey(task.date) });
      } else {
        const minutes = task.calendarDurationMinutes ?? DEFAULT_TASK_MINUTES;
        events.push({
          ...base,
          start: task.date,
          end: new Date(task.date.getTime() + minutes * MS_PER_MINUTE),
        });
      }
    }

    const body = buildIcsFeed(events, { calendarName: 'Productivity Maxing' });
    this.cache.set(cacheKey, {
      body,
      expiresAt: Date.now() + FEED_CACHE_TTL_MS,
    });
    this.pruneCache();
    return body;
  }

  // Aulas, turnos, viagens e blocos de estudo (tudo menos tasks).
  private async buildScheduleEvents(
    userId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<FeedEvent[]> {
    const [classes, shifts, plan] = await Promise.all([
      this.scheduleService.findRange(userId, rangeStart, rangeEnd),
      this.workShiftsService.expandRange(
        userId,
        toDateKey(rangeStart),
        toDateKey(rangeEnd),
      ),
      this.studyPlanService.generate(userId, STUDY_PLAN_DAYS),
    ]);

    // Viagens pelo mesmo itinerario do sync, mas so com tempos ja guardados:
    // o feed e publico (pedido pelos calendarios) e nunca gera custos na
    // Google.
    const travel = flattenItinerary(
      await this.itineraryService.buildRange(
        userId,
        classes.map((c) => ({
          id: c.id,
          date: toDateKey(c.date),
          startMinutes: c.startMinutes,
          endMinutes: c.endMinutes,
        })),
        shifts,
        { allowLookups: false },
      ),
    );

    // Reaproveita o MESMO construtor do sync com o Google Calendar: aulas,
    // viagens, turnos e blocos de estudo ficam iguais nos dois sítios.
    const desired = buildDesiredEvents({
      classes: classes.map((c) => ({
        id: c.id,
        date: toDateKey(c.date),
        startMinutes: c.startMinutes,
        endMinutes: c.endMinutes,
        subject: c.subject,
        location: c.location,
        professor: c.professor,
      })),
      shifts,
      study: plan.suggestions,
      travel,
    });

    return desired.map((d) => ({
      // O sourceKey tem ":" - válido num UID; o domínio evita colisões com
      // outros calendários subscritos.
      uid: `${d.sourceKey}@productivitymaxing`,
      title: d.title,
      description: d.description,
      location: d.location,
      category: d.kind,
      start: lisbonWallClockToUtc(d.date, d.startMinutes),
      end: lisbonWallClockToUtc(d.date, d.endMinutes),
    }));
  }

  // Um token revogado deixa de servir logo, em todas as variantes (?only=).
  private forgetToken(token: string): void {
    for (const scope of FEED_SCOPES) this.cache.delete(`${token}:${scope}`);
  }

  private pruneCache(): void {
    if (this.cache.size < 200) return;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
