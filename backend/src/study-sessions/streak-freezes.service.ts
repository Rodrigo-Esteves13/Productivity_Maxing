import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  lisbonDayBounds,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import {
  DAYS_PER_WEEK,
  FREEZE_LIST_WINDOW_DAYS,
  FREEZE_MAX_DAYS_BACK,
  FREEZE_MAX_PER_WEEK,
  ISO_WEEK_MONDAY_SHIFT,
} from './streak-freeze.constants';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const FREEZE_SELECT = { id: true, dateKey: true, createdAt: true } as const;

export interface StreakFreezeRow {
  id: string;
  dateKey: string;
  createdAt: Date;
}

export interface StreakFreezeStatus {
  todayKey: string;
  freezes: StreakFreezeRow[];
  // Id do descanso de hoje (so esse pode ser desfeito), ou null.
  todayFreezeId: string | null;
  usedThisWeek: number;
  maxPerWeek: number;
  // Hoje: sem descanso ainda, semana com vaga e sem sessao de estudo hoje.
  canFreezeToday: boolean;
}

/** Segunda e domingo (chaves YYYY-MM-DD) da semana ISO de `dateKey`. */
export function isoWeekRange(dateKey: string): { from: string; to: string } {
  const day = parseDateKey(dateKey);
  const sinceMonday = (day.getUTCDay() + ISO_WEEK_MONDAY_SHIFT) % DAYS_PER_WEEK;
  const monday = addUtcDays(day, -sinceMonday);
  return {
    from: toDateKey(monday),
    to: toDateKey(addUtcDays(monday, DAYS_PER_WEEK - 1)),
  };
}

/**
 * Dias de descanso da streak de estudo: o user diz "hoje (ou ontem) nao
 * estudo", e esse dia faz ponte na streak (nao a aumenta nem a parte, ver
 * walkStreak). No maximo FREEZE_MAX_PER_WEEK por semana ISO e nunca num dia
 * que ja tem sessao de estudo. Todas as queries filtram pelo userId.
 */
@Injectable()
export class StreakFreezesService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<StreakFreezeStatus> {
    const todayKey = toDateKey(getLisbonNow().today);
    const sinceKey = toDateKey(
      addUtcDays(parseDateKey(todayKey), -FREEZE_LIST_WINDOW_DAYS),
    );
    const week = isoWeekRange(todayKey);
    const fromKey = week.from < sinceKey ? week.from : sinceKey;
    const [rows, activeToday] = await Promise.all([
      this.prisma.streakFreeze.findMany({
        where: { userId, dateKey: { gte: fromKey, lte: todayKey } },
        select: FREEZE_SELECT,
        orderBy: { dateKey: 'desc' },
      }),
      this.hasActivity(userId, todayKey),
    ]);
    const todayFreeze = rows.find((r) => r.dateKey === todayKey) ?? null;
    const usedThisWeek = rows.filter(
      (r) => r.dateKey >= week.from && r.dateKey <= week.to,
    ).length;
    return {
      todayKey,
      freezes: rows.filter((r) => r.dateKey >= sinceKey),
      todayFreezeId: todayFreeze?.id ?? null,
      usedThisWeek,
      maxPerWeek: FREEZE_MAX_PER_WEEK,
      canFreezeToday:
        todayFreeze === null &&
        usedThisWeek < FREEZE_MAX_PER_WEEK &&
        !activeToday,
    };
  }

  /** Idempotente: pedir de novo o mesmo dia devolve o descanso existente. */
  async create(userId: string, dateKey?: string): Promise<StreakFreezeRow> {
    const todayKey = toDateKey(getLisbonNow().today);
    const key = dateKey ?? todayKey;
    this.assertAllowedDay(key, todayKey);

    const existing = await this.prisma.streakFreeze.findUnique({
      where: { userId_dateKey: { userId, dateKey: key } },
      select: FREEZE_SELECT,
    });
    if (existing) return existing;

    if (await this.hasActivity(userId, key)) {
      throw new BadRequestException(
        'That day already has a study session, so it cannot be a rest day.',
      );
    }
    const week = isoWeekRange(key);
    const weekWhere = {
      userId,
      dateKey: { gte: week.from, lte: week.to },
    };
    if (
      (await this.prisma.streakFreeze.count({ where: weekWhere })) >=
      FREEZE_MAX_PER_WEEK
    ) {
      throw new ConflictException('No rest days left this week.');
    }

    let created: StreakFreezeRow;
    try {
      created = await this.prisma.streakFreeze.create({
        data: { userId, dateKey: key },
        select: FREEZE_SELECT,
      });
    } catch (err) {
      // Pedido duplicado em paralelo para o mesmo dia: devolve o que ganhou.
      if ((err as { code?: string } | null)?.code === PRISMA_UNIQUE_VIOLATION) {
        const winner = await this.prisma.streakFreeze.findUnique({
          where: { userId_dateKey: { userId, dateKey: key } },
          select: FREEZE_SELECT,
        });
        if (winner) return winner;
      }
      throw err;
    }
    // Dois pedidos em paralelo para dias diferentes da mesma semana podem
    // passar os dois a contagem: o que fica acima do limite e desfeito.
    if (
      (await this.prisma.streakFreeze.count({ where: weekWhere })) >
      FREEZE_MAX_PER_WEEK
    ) {
      await this.prisma.streakFreeze.deleteMany({
        where: { id: created.id, userId },
      });
      throw new ConflictException('No rest days left this week.');
    }
    return created;
  }

  /** So o descanso de hoje pode ser desfeito (o passado fica como esta). */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.streakFreeze.findFirst({
      where: { id, userId },
      select: { id: true, dateKey: true },
    });
    if (!row) throw new NotFoundException('Rest day not found.');
    const todayKey = toDateKey(getLisbonNow().today);
    if (row.dateKey !== todayKey) {
      throw new BadRequestException("Only today's rest day can be undone.");
    }
    await this.prisma.streakFreeze.deleteMany({ where: { id, userId } });
  }

  private assertAllowedDay(key: string, todayKey: string): void {
    // A regex do DTO aceita 2026-02-31: so conta se a data existir mesmo.
    const parsed = parseDateKey(key);
    if (Number.isNaN(parsed.getTime()) || toDateKey(parsed) !== key) {
      throw new BadRequestException('Invalid date.');
    }
    const daysBack = diffUtcDays(parsed, parseDateKey(todayKey));
    if (daysBack < 0 || daysBack > FREEZE_MAX_DAYS_BACK) {
      throw new BadRequestException(
        'A rest day can only be today or yesterday.',
      );
    }
  }

  // Qualquer sessao comecada nesse dia de Lisboa (terminada ou a decorrer).
  private async hasActivity(userId: string, dateKey: string): Promise<boolean> {
    const { start, end } = lisbonDayBounds(dateKey);
    const session = await this.prisma.studySession.findFirst({
      where: { userId, startedAt: { gte: start, lt: end } },
      select: { id: true },
    });
    return session !== null;
  }
}
