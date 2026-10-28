import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../common/time.constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import { WorkShiftsService } from '../work-shifts/work-shifts.service';
import { StudyPlanService } from '../study-plan/study-plan.service';
import {
  addUtcDays,
  getLisbonNow,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import { CalendarService } from './calendar.service';
import { buildDesiredEvents, diffEvents } from './schedule-sync.builder';
import { ItineraryService } from '../schedule/itinerary.service';
import { flattenItinerary } from '../schedule/itinerary.builder';
import {
  CALENDAR_TIME_ZONE,
  COLOR_ID_BY_KIND,
  GOOGLE_CONCURRENCY,
  MAX_OPERATIONS_PER_SYNC,
  MAX_PREVIEW_ITEMS,
  MAX_REMOVE_ALL_PER_REQUEST,
  PMAXING_EVENT_MARKER,
} from './schedule-sync.constants';
import type {
  DesiredEvent,
  ExistingSyncedEvent,
  SyncDiff,
  SyncPreview,
  SyncPreviewItem,
  SyncResult,
} from './schedule-sync.types';
import { HTTP_GONE, HTTP_NOT_FOUND } from './http-codes';
import { googleFetch } from './google-fetch.util';

// Calendario da app para o sync em curso. E mutavel de proposito: se a pessoa
// apagou o calendario, a primeira criacao a falhar com 404 substitui-o e os
// restantes pedidos paralelos passam a usar o novo.
interface CalendarContext {
  accessToken: string;
  calendarId: string;
}

interface SyncPlan {
  diff: SyncDiff;
  days: number;
}

@Injectable()
export class ScheduleSyncService {
  private readonly logger = new Logger(ScheduleSyncService.name);
  // Um sync de cada vez por utilizador: dois em paralelo criariam eventos
  // duplicados na Google antes de qualquer um gravar a sua linha.
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: CalendarService,
    private readonly scheduleService: ScheduleService,
    private readonly workShiftsService: WorkShiftsService,
    private readonly studyPlanService: StudyPlanService,
    private readonly itineraryService: ItineraryService,
  ) {}

  /** O que um sync faria, sem escrever NADA (nem na Google nem na BD). */
  async preview(userId: string, days: number): Promise<SyncPreview> {
    const { diff } = await this.computePlan(userId, days);
    return this.toPreview(diff, days);
  }

  async sync(userId: string, days: number): Promise<SyncResult> {
    if (this.running.has(userId)) {
      throw new ConflictException('A calendar sync is already running.');
    }
    this.running.add(userId);

    try {
      const accessToken = await this.calendarService.getAccessToken(userId);
      const ctx: CalendarContext = {
        accessToken,
        calendarId: await this.calendarService.getCalendarId(
          userId,
          accessToken,
        ),
      };
      const { diff } = await this.computePlan(userId, days);

      const operations =
        diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;
      if (operations > MAX_OPERATIONS_PER_SYNC) {
        throw new BadRequestException(
          `This sync would change ${operations} events (limit ${MAX_OPERATIONS_PER_SYNC}). Try fewer days.`,
        );
      }

      const result: SyncResult = {
        created: 0,
        updated: 0,
        deleted: 0,
        unchanged: diff.unchangedCount,
        failed: 0,
      };

      const tasks: (() => Promise<void>)[] = [
        ...diff.toCreate.map((d) => async () => {
          await this.createEvent(userId, ctx, d);
          result.created += 1;
        }),
        ...diff.toUpdate.map(({ desired, existing }) => async () => {
          await this.updateEvent(userId, ctx, desired, existing);
          result.updated += 1;
        }),
        ...diff.toDelete.map((existing) => async () => {
          await this.deleteEvent(userId, ctx, existing);
          result.deleted += 1;
        }),
      ];

      await this.runWithConcurrency(tasks, () => {
        result.failed += 1;
      });

      return result;
    } finally {
      this.running.delete(userId);
    }
  }

  /**
   * Remove do Google Calendar TODOS os eventos que esta app criou (nunca os
   * teus). Processa até MAX_REMOVE_ALL_PER_REQUEST por pedido; se sobrarem,
   * `remaining` > 0 e basta repetir.
   */
  async removeAll(
    userId: string,
  ): Promise<{ deleted: number; failed: number; remaining: number }> {
    if (this.running.has(userId)) {
      throw new ConflictException('A calendar sync is already running.');
    }
    this.running.add(userId);

    try {
      const accessToken = await this.calendarService.getAccessToken(userId);
      const ctx: CalendarContext = {
        accessToken,
        calendarId: await this.calendarService.getCalendarId(
          userId,
          accessToken,
        ),
      };
      const rows = await this.prisma.calendarSyncedEvent.findMany({
        where: { userId },
        select: { id: true, googleEventId: true },
        take: MAX_REMOVE_ALL_PER_REQUEST,
      });

      let deleted = 0;
      let failed = 0;
      await this.runWithConcurrency(
        rows.map((row) => async () => {
          await this.deleteFromGoogle(ctx, row.googleEventId);
          await this.prisma.calendarSyncedEvent.deleteMany({
            where: { id: row.id, userId },
          });
          deleted += 1;
        }),
        () => {
          failed += 1;
        },
      );

      const remaining = await this.prisma.calendarSyncedEvent.count({
        where: { userId },
      });
      return { deleted, failed, remaining };
    } finally {
      this.running.delete(userId);
    }
  }

  // ---------------------------------------------------------------- plano

  private async computePlan(userId: string, days: number): Promise<SyncPlan> {
    const { today, nowMinutes } = getLisbonNow();
    const rangeEnd = addUtcDays(today, days - 1);
    const todayKey = toDateKey(today);

    const [classes, shifts, plan, existingRows] = await Promise.all([
      this.scheduleService.findRange(userId, today, rangeEnd),
      this.workShiftsService.expandRange(userId, todayKey, toDateKey(rangeEnd)),
      this.studyPlanService.generate(userId, days),
      this.prisma.calendarSyncedEvent.findMany({
        where: { userId, windowDate: { gte: today, lte: rangeEnd } },
        select: {
          id: true,
          sourceKey: true,
          googleEventId: true,
          contentHash: true,
          windowDate: true,
          startMinutes: true,
          endMinutes: true,
          title: true,
        },
      }),
    ]);

    const classInputs = classes.map((c) => ({
      id: c.id,
      date: toDateKey(c.date),
      startMinutes: c.startMinutes,
      endMinutes: c.endMinutes,
    }));
    const travel = flattenItinerary(
      await this.itineraryService.buildRange(userId, classInputs, shifts),
    );

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

    const existing: ExistingSyncedEvent[] = existingRows.map((row) => ({
      id: row.id,
      sourceKey: row.sourceKey,
      googleEventId: row.googleEventId,
      contentHash: row.contentHash,
      date: toDateKey(row.windowDate),
      startMinutes: row.startMinutes,
      endMinutes: row.endMinutes,
      title: row.title,
    }));

    return {
      diff: diffEvents(desired, existing, { todayKey, nowMinutes }),
      days,
    };
  }

  private toPreview(diff: SyncDiff, days: number): SyncPreview {
    const operations =
      diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;

    const all: SyncPreviewItem[] = [
      ...diff.toCreate.map((d) =>
        this.toItem('create', d.title, d.date, d.startMinutes, d.endMinutes),
      ),
      ...diff.toUpdate.map(({ desired: d }) =>
        this.toItem('update', d.title, d.date, d.startMinutes, d.endMinutes),
      ),
      ...diff.toDelete.map((e) =>
        this.toItem('remove', e.title, e.date, e.startMinutes, e.endMinutes),
      ),
    ].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes,
    );

    return {
      create: diff.toCreate.length,
      update: diff.toUpdate.length,
      remove: diff.toDelete.length,
      unchanged: diff.unchangedCount,
      withinLimit: operations <= MAX_OPERATIONS_PER_SYNC,
      days,
      items: all.slice(0, MAX_PREVIEW_ITEMS),
      hiddenCount: Math.max(0, all.length - MAX_PREVIEW_ITEMS),
    };
  }

  private toItem(
    action: SyncPreviewItem['action'],
    title: string,
    date: string,
    startMinutes: number,
    endMinutes: number,
  ): SyncPreviewItem {
    return { action, title, date, startMinutes, endMinutes };
  }

  // --------------------------------------------------------------- Google

  private toGoogleDateTime(date: string, minutes: number): string {
    // 24:00 não existe em RFC3339: meia-noite é 00:00 do dia seguinte.
    const dayOffset = Math.floor(minutes / MINUTES_PER_DAY);
    const dayKey = toDateKey(addUtcDays(parseDateKey(date), dayOffset));
    const inDay = minutes % MINUTES_PER_DAY;
    const hh = String(Math.floor(inDay / MINUTES_PER_HOUR)).padStart(2, '0');
    const mm = String(inDay % MINUTES_PER_HOUR).padStart(2, '0');
    return `${dayKey}T${hh}:${mm}:00`;
  }

  private toGoogleEvent(event: DesiredEvent) {
    return {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: {
        dateTime: this.toGoogleDateTime(event.date, event.startMinutes),
        timeZone: CALENDAR_TIME_ZONE,
      },
      end: {
        dateTime: this.toGoogleDateTime(event.date, event.endMinutes),
        timeZone: CALENDAR_TIME_ZONE,
      },
      colorId: COLOR_ID_BY_KIND[event.kind],
      // Sem notificações: aulas e blocos de estudo em massa não devem
      // apitar no telemóvel a cada evento.
      reminders: { useDefault: false },
      extendedProperties: { private: { pmaxing: PMAXING_EVENT_MARKER } },
    };
  }

  private async googleRequest(
    ctx: CalendarContext,
    method: 'POST' | 'PATCH' | 'DELETE',
    eventId: string | null,
    body?: unknown,
  ): Promise<Response> {
    const eventsUrl = this.calendarService.eventsUrl(ctx.calendarId);
    return googleFetch(eventId ? `${eventsUrl}/${eventId}` : eventsUrl, {
      method,
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async createEvent(
    userId: string,
    ctx: CalendarContext,
    desired: DesiredEvent,
  ): Promise<void> {
    let res = await this.googleRequest(
      ctx,
      'POST',
      null,
      this.toGoogleEvent(desired),
    );

    // 404 na criacao: a pessoa apagou o calendario "Productivity Maxing".
    // Recria-o (ou reaproveita o que outro pedido paralelo ja recriou) e
    // tenta uma unica vez.
    if (res.status === HTTP_NOT_FOUND) {
      ctx.calendarId = await this.calendarService.replaceCalendar(
        userId,
        ctx.accessToken,
        ctx.calendarId,
      );
      res = await this.googleRequest(
        ctx,
        'POST',
        null,
        this.toGoogleEvent(desired),
      );
    }
    if (!res.ok) throw new Error(`Google create failed: ${await res.text()}`);

    const { id } = (await res.json()) as { id: string };
    // Grava a linha logo a seguir a cada criação: se o processo morrer a
    // meio, o evento não fica órfão na Google sem registo nosso.
    await this.prisma.calendarSyncedEvent.upsert({
      where: { userId_sourceKey: { userId, sourceKey: desired.sourceKey } },
      create: this.rowData(userId, desired, id),
      update: this.rowData(userId, desired, id),
    });
  }

  private async updateEvent(
    userId: string,
    ctx: CalendarContext,
    desired: DesiredEvent,
    existing: ExistingSyncedEvent,
  ): Promise<void> {
    const res = await this.googleRequest(
      ctx,
      'PATCH',
      existing.googleEventId,
      this.toGoogleEvent(desired),
    );

    // 404/410: apagaste-o à mão no Google Calendar, ou o evento vive no
    // calendário primário (scope antigo) e já não lhe conseguimos tocar.
    // Volta a criar no calendário da app.
    if (res.status === HTTP_NOT_FOUND || res.status === HTTP_GONE) {
      await this.createEvent(userId, ctx, desired);
      return;
    }
    if (!res.ok) throw new Error(`Google update failed: ${await res.text()}`);

    await this.prisma.calendarSyncedEvent.updateMany({
      where: { id: existing.id, userId },
      data: {
        contentHash: desired.contentHash,
        windowDate: parseDateKey(desired.date),
        startMinutes: desired.startMinutes,
        endMinutes: desired.endMinutes,
        title: desired.title,
      },
    });
  }

  private async deleteEvent(
    userId: string,
    ctx: CalendarContext,
    existing: ExistingSyncedEvent,
  ): Promise<void> {
    await this.deleteFromGoogle(ctx, existing.googleEventId);
    await this.prisma.calendarSyncedEvent.deleteMany({
      where: { id: existing.id, userId },
    });
  }

  private async deleteFromGoogle(
    ctx: CalendarContext,
    googleEventId: string,
  ): Promise<void> {
    const res = await this.googleRequest(ctx, 'DELETE', googleEventId);
    // 404/410 = já não existe do lado da Google: é o resultado que queríamos.
    if (!res.ok && res.status !== HTTP_NOT_FOUND && res.status !== HTTP_GONE) {
      throw new Error(`Google delete failed: ${await res.text()}`);
    }
  }

  private rowData(
    userId: string,
    desired: DesiredEvent,
    googleEventId: string,
  ) {
    return {
      userId,
      sourceKey: desired.sourceKey,
      googleEventId,
      contentHash: desired.contentHash,
      windowDate: parseDateKey(desired.date),
      startMinutes: desired.startMinutes,
      endMinutes: desired.endMinutes,
      title: desired.title,
    };
  }

  /**
   * Corre as tarefas com um máximo de GOOGLE_CONCURRENCY em simultâneo.
   * Uma falha não aborta as restantes: é contada e o sync continua.
   */
  private async runWithConcurrency(
    tasks: (() => Promise<void>)[],
    onFailure: () => void,
  ): Promise<void> {
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const current = tasks[next++];
        try {
          await current();
        } catch (error) {
          onFailure();
          this.logger.error(
            `Calendar sync operation failed: ${(error as Error).message}`,
          );
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(GOOGLE_CONCURRENCY, tasks.length) },
        worker,
      ),
    );
  }
}
