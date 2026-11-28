import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  toDateKey,
} from '../common/date-key.util';
import { MINUTES_PER_HOUR } from '../common/time.constants';
import { summarizeAttendance } from '../schedule/attendance-summary.util';
import {
  absenceRisk,
  DEFAULT_ABSENCE_LIMIT_PCT,
} from '../schedule/absence-limit.util';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.ABSENCE_LIMIT;

interface PageUser {
  id: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  activePeriod: { startDate: Date; endDate: Date | null } | null;
}

interface AttendanceRow {
  subject: string;
  attended: boolean | null;
  _count: { _all: number };
}

const SCHEDULE_PATH = '/schedule';
// Nao acorda ninguem de madrugada mesmo sem horas de silencio configuradas.
const EARLIEST_SEND_MINUTES = 9 * MINUTES_PER_HOUR;
// Janela de envio deterministica (hora de Lisboa): so segunda-feira, das 09:00
// as 21:00. O dedupe semanal e o marcador duravel em SentNotification; a
// janela continua a garantir que fora dela nunca se envia. O cron externo
// pode correr com 4-6h de intervalo (docs/adr/0006-external-cron-for-reminders.md),
// por isso 12h garante pelo menos uma execucao dentro da janela, e o fim as
// 21:00 evita pushes noturnos (uma janela ate terca 09:00 ficaria inutil a
// noite por causa de EARLIEST_SEND_MINUTES).
const SEND_WEEKDAY_UTC_INDEX = 1; // segunda (today e meia-noite UTC do dia de Lisboa)
const SEND_WINDOW_END_MINUTES = 21 * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const USER_BATCH_SIZE = 500;
// Sem periodo ativo: olha para as aulas dos ultimos 6 meses.
const FALLBACK_WINDOW_DAYS = 180;
// O texto do push lista no maximo estas disciplinas, o resto vira "+N".
const MAX_SUBJECTS_IN_PUSH = 3;
const SUBJECT_SEPARATOR = ', ';
const THURSDAY_INDEX = 4;
const DAYS_PER_WEEK = 7;

/** Chave da semana ISO ("2026-W44") de um dia UTC-midnight. */
export function isoWeekKey(day: Date): string {
  const d = new Date(day);
  const weekday = d.getUTCDay() || DAYS_PER_WEEK;
  // A semana ISO pertence ao ano da sua quinta-feira.
  d.setUTCDate(d.getUTCDate() + THURSDAY_INDEX - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = diffUtcDays(yearStart, d) + 1;
  const week = Math.ceil(dayOfYear / DAYS_PER_WEEK);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Segunda-feira, 09:00-21:00 em Lisboa (`today` = meia-noite UTC do dia). */
export function isInSendWindow(today: Date, nowMinutes: number): boolean {
  return (
    today.getUTCDay() === SEND_WEEKDAY_UTC_INDEX &&
    nowMinutes >= EARLIEST_SEND_MINUTES &&
    nowMinutes < SEND_WINDOW_END_MINUTES
  );
}

/**
 * Aviso semanal "estas perto do limite de faltas". Um unico push por user e
 * por semana ISO, com todas as disciplinas perto/acima do limite.
 *
 * Limitacoes conhecidas:
 * - O limite de faltas e uma preferencia so do cliente (localStorage), por
 *   isso aqui vale sempre o valor por omissao (25%).
 * - Dedupe semanal duravel em SentNotification (periodo = semana ISO),
 *   sobrevive a restarts/redeploys dentro da janela. So fica marcado quando
 *   algum dispositivo recebeu.
 * - Utilizadores sem risco hoje sao memorizados por dia (memo em memoria, so
 *   uma otimizacao) e saltados ate ao dia seguinte, para nao refazer a query
 *   de 15 em 15 min.
 */
@Injectable()
export class AbsenceLimitRemindersService {
  private readonly logger = new Logger(AbsenceLimitRemindersService.name);
  // userId -> dia (YYYY-MM-DD, Lisboa) em que foi avaliado sem risco.
  private readonly evaluatedNoRisk = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  // O relogio vem de getLisbonNow() (hora de Lisboa).
  async sendWeeklyReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInSendWindow(today, nowMinutes)) return 0;
    const week = isoWeekKey(today);
    const dayKey = toDateKey(today);
    // Dia novo: esquece os anteriores (o mapa nao cresce sem fim).
    for (const [userId, day] of this.evaluatedNoRisk) {
      if (day !== dayKey) this.evaluatedNoRisk.delete(userId);
    }

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      // Pagina por `id > ultimo id` e nao por cursor+skip do Prisma: esse
      // salta sempre 1 linha a partir do cursor, e se o ultimo user da pagina
      // deixou de cumprir o filtro entretanto (ex: o notifyUser acabou de
      // apagar a sua subscricao morta, 404/410) o salto comia o user seguinte;
      // se o user foi apagado, o cursor nao existia e o resto ficava por ver.
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          activePeriod: { select: { startDate: true, endDate: true } },
        },
        orderBy: { id: 'asc' },
        take: USER_BATCH_SIZE,
      });
      // 1 query por pagina: quem ja foi avisado nesta semana.
      const notified = await this.sentNotifications.claimedUserIds(
        users.map((u) => u.id),
        KIND,
        week,
      );
      const candidates = users.filter(
        (user) =>
          !notified.has(user.id) &&
          this.evaluatedNoRisk.get(user.id) !== dayKey &&
          !this.isQuietHour(user, nowMinutes),
      );
      // Falha da query da pagina: log so com o nome do erro e segue para a
      // proxima pagina (nao aborta a corrida).
      let attendance: Map<string, AttendanceRow[]>;
      try {
        attendance = await this.loadAttendance(candidates, today);
      } catch (err) {
        this.logger.error(
          `Limite de faltas: falhou a leitura de uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
        attendance = new Map();
      }
      for (const user of candidates) {
        const userRows = attendance.get(user.id);
        if (!userRows) continue;
        // Um user que falha nao pode abortar a corrida dos seguintes (a ordem
        // e deterministica, os mesmos ficariam sempre sem aviso). Log so com o id.
        try {
          if (await this.processUser(user.id, userRows, { week, dayKey })) {
            sent += 1;
          }
        } catch (err) {
          this.logger.error(
            `Limite de faltas: falhou o utilizador ${user.id} (${
              err instanceof Error ? err.name : 'erro'
            })`,
          );
        }
      }
      if (users.length < USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Limite de faltas: ${sent} utilizadores avisados`);
    }
    return sent;
  }

  /**
   * Faltas dos users da pagina. Cada user tem a sua janela (inicio do periodo
   * ate hoje ou ao fim do periodo): os users com a mesma janela partilham um
   * unico groupBy (userId in [...]), por isso o custo e uma query por janela
   * distinta e nao uma por user. Users sem aulas ficam com lista vazia.
   */
  private async loadAttendance(
    users: PageUser[],
    today: Date,
  ): Promise<Map<string, AttendanceRow[]>> {
    const byWindow = new Map<
      string,
      { from: Date; endOfTo: Date; ids: string[] }
    >();
    for (const user of users) {
      const from =
        user.activePeriod?.startDate ??
        addUtcDays(today, -FALLBACK_WINDOW_DAYS);
      const periodEnd = user.activePeriod?.endDate;
      const to = periodEnd && periodEnd < today ? periodEnd : today;
      // O fim do periodo inclui o dia todo (mesma regra do /attendance).
      const endOfTo = new Date(to);
      endOfTo.setUTCHours(23, 59, 59, 999);
      const key = `${from.getTime()}|${endOfTo.getTime()}`;
      const bucket = byWindow.get(key) ?? { from, endOfTo, ids: [] };
      bucket.ids.push(user.id);
      byWindow.set(key, bucket);
    }

    const result = new Map<string, AttendanceRow[]>();
    for (const { from, endOfTo, ids } of byWindow.values()) {
      for (const id of ids) result.set(id, []);
      const grouped = await this.prisma.classOccurrence.groupBy({
        by: ['userId', 'subject', 'attended'],
        where: {
          userId: { in: ids },
          date: { gte: from, lte: endOfTo },
          cancelled: false,
        },
        _count: { _all: true },
      });
      for (const { userId, ...row } of grouped) {
        result.get(userId)?.push(row);
      }
    }
    return result;
  }

  private async processUser(
    userId: string,
    rows: AttendanceRow[],
    ctx: { week: string; dayKey: string },
  ): Promise<boolean> {
    const { week, dayKey } = ctx;
    const risky = summarizeAttendance(rows).filter(
      (row) => absenceRisk(row, DEFAULT_ABSENCE_LIMIT_PCT) !== 'none',
    );
    if (risky.length === 0) {
      this.evaluatedNoRisk.set(userId, dayKey);
      return false;
    }

    const shown = risky
      .slice(0, MAX_SUBJECTS_IN_PUSH)
      .map((row) => row.subject)
      .join(SUBJECT_SEPARATOR);
    const extra = risky.length - MAX_SUBJECTS_IN_PUSH;
    // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
    if (!(await this.sentNotifications.claim(userId, KIND, week))) {
      return false;
    }
    let delivered = 0;
    try {
      delivered = await this.pushService.notifyUser(
        userId,
        'absenceLimitNear',
        {
          title: extra > 0 ? `${shown} +${extra}` : shown,
          url: SCHEDULE_PATH,
        },
      );
    } finally {
      // Sem dispositivo que tenha recebido: desmarca, tenta na proxima.
      if (delivered === 0) {
        await this.sentNotifications.release(userId, KIND, week);
      }
    }
    return delivered > 0;
  }

  private isQuietHour(
    user: { quietHoursStart: number | null; quietHoursEnd: number | null },
    nowMinutes: number,
  ): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
