import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceEntryKind, type FinanceEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateKey } from '../common/date-key.util';
import {
  CreateFinanceEntryDto,
  CreateFinanceGoalDto,
  UpdateFinanceGoalDto,
  UpdateFinanceSettingsDto,
} from './dto/finance.dto';
import {
  MAX_FINANCE_ENTRIES_PER_USER,
  MAX_FINANCE_GOALS_PER_USER,
} from './finance.constants';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const DEFAULT_SETTINGS = {
  currency: 'EUR',
  balanceCents: 0,
  monthlyBudgetCents: null,
  leisureBudgetCents: null,
};

const SETTINGS_SELECT = {
  currency: true,
  balanceCents: true,
  monthlyBudgetCents: true,
  leisureBudgetCents: true,
} as const;

/** [inicio do mes, inicio do mes seguinte) em meia-noite UTC. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new BadRequestException('month must be formatted YYYY-MM.');
  }
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, index, 1)),
    end: new Date(Date.UTC(year, index + 1, 1)),
  };
}

/** Somas de um mes. Despesas de LEISURE contam tambem para o lazer. */
export function summarize(
  entries: Pick<FinanceEntry, 'kind' | 'amountCents' | 'category'>[],
) {
  let income = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind === FinanceEntryKind.INCOME) {
      income += e.amountCents;
    } else {
      expense += e.amountCents;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountCents;
    }
  }
  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    leisureCents: byCategory.LEISURE ?? 0,
    expensesByCategory: byCategory,
  };
}

// Financas pessoais: so regista e soma o que a pessoa escreve. Nao ha
// ligacao a bancos nem recomendacoes.
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, month: string) {
    const { start, end } = monthBounds(month);
    const [settings, entries, goals] = await Promise.all([
      this.prisma.financeSettings.findUnique({
        where: { userId },
        select: SETTINGS_SELECT,
      }),
      // As do mes e as mensais que ja tinham comecado antes.
      this.prisma.financeEntry.findMany({
        where: {
          userId,
          OR: [
            { date: { gte: start, lt: end } },
            { recurring: true, date: { lt: start } },
          ],
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.financeGoal.findMany({
        where: { userId },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return {
      month,
      settings: settings ?? DEFAULT_SETTINGS,
      entries,
      totals: summarize(entries),
      goals,
    };
  }

  updateSettings(userId: string, dto: UpdateFinanceSettingsDto) {
    return this.prisma.financeSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: SETTINGS_SELECT,
    });
  }

  async createEntry(userId: string, dto: CreateFinanceEntryDto) {
    const count = await this.prisma.financeEntry.count({ where: { userId } });
    if (count >= MAX_FINANCE_ENTRIES_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
      );
    }
    return this.prisma.financeEntry.create({
      data: {
        userId,
        kind: dto.kind,
        amountCents: dto.amountCents,
        category: dto.category,
        note: dto.note || null,
        date: parseDateKey(dto.date),
        recurring: dto.recurring ?? false,
      },
    });
  }

  async removeEntry(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeEntry.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Entry not found.');
  }

  async createGoal(userId: string, dto: CreateFinanceGoalDto) {
    const count = await this.prisma.financeGoal.count({ where: { userId } });
    if (count >= MAX_FINANCE_GOALS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_GOALS_PER_USER} goals.`,
      );
    }
    return this.prisma.financeGoal.create({
      data: {
        userId,
        kind: dto.kind,
        name: dto.name,
        targetCents: dto.targetCents,
        savedCents: dto.savedCents ?? 0,
        deadline: dto.deadline ? parseDateKey(dto.deadline) : null,
      },
    });
  }

  async updateGoal(userId: string, id: string, dto: UpdateFinanceGoalDto) {
    const { count } = await this.prisma.financeGoal.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetCents !== undefined && { targetCents: dto.targetCents }),
        ...(dto.savedCents !== undefined && { savedCents: dto.savedCents }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline === null ? null : parseDateKey(dto.deadline),
        }),
      },
    });
    if (count === 0) throw new NotFoundException('Goal not found.');
    return this.prisma.financeGoal.findFirstOrThrow({ where: { id, userId } });
  }

  async removeGoal(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeGoal.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Goal not found.');
  }
}
