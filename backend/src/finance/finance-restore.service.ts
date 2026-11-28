import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDateKey } from '../common/date-key.util';
import type {
  RestoreFinanceAccountDto,
  RestoreFinanceEntryDto,
} from './dto/finance.dto';
import { resolveFrequency } from './finance-schedule.util';
import { parseDay, resolveOwed, resolveRule } from './finance.service';
import {
  MAX_FINANCE_ACCOUNTS_PER_USER,
  MAX_FINANCE_ENTRIES_PER_USER,
  MAX_RESTORE_PAYMENT_LINKS,
} from './finance.constants';

const DELETED_INCLUDE = {
  owedPayments: { select: { id: true } },
  owedPaymentIncome: { select: { id: true } },
} satisfies Prisma.FinanceEntryInclude;

type DeletedRow = Prisma.FinanceEntryGetPayload<{
  include: typeof DELETED_INCLUDE;
}>;

const dayOrNull = (date: Date | null) => (date ? toDateKey(date) : null);

/** Linha apagada no formato que POST /finance/entries/restore aceita. */
export function toRestoreEntry(row: DeletedRow): RestoreFinanceEntryDto {
  return {
    clientRequestId: row.id,
    kind: row.kind,
    amountCents: row.amountCents,
    category: row.category,
    note: row.note ?? undefined,
    date: toDateKey(row.date),
    frequency: resolveFrequency(row),
    payDayRule: row.payDayRule,
    payDay: row.payDay,
    endDate: dayOrNull(row.endDate),
    accountId: row.accountId,
    skipFirstOccurrences: row.skipFirstOccurrences,
    paidInArrearsMonths: row.paidInArrearsMonths,
    withheldCents: row.withheldCents,
    isOwed: row.isOwed,
    debtorName: row.debtorName,
    expectedDate: dayOrNull(row.expectedDate),
    latePaymentRiskPct: row.latePaymentRiskPct,
    interestRatePct:
      row.interestRatePct === null ? null : Number(row.interestRatePct),
    interestKind: row.interestKind,
    receivedAt: dayOrNull(row.receivedAt),
    debtPaymentIds: row.owedPayments
      .slice(0, MAX_RESTORE_PAYMENT_LINKS)
      .map((p) => p.id),
    incomePaymentId: row.owedPaymentIncome?.id ?? null,
  };
}

// Apagar varios movimentos e anular o apagar (movimentos e contas). Tudo
// filtrado por userId: ids de outra pessoa sao ignorados.
@Injectable()
export class FinanceRestoreService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteEntries(userId: string, ids: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const where = { id: { in: ids }, userId };
      // Lidas antes de apagar: o onDelete SetNull perde as ligacoes.
      const rows = await tx.financeEntry.findMany({
        where,
        include: DELETED_INCLUDE,
      });
      if (rows.length === 0) throw new NotFoundException('Entry not found.');
      await tx.financeEntry.deleteMany({ where });
      return { entries: rows.map(toRestoreEntry) };
    });
  }

  async restoreEntries(userId: string, entries: RestoreFinanceEntryDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const keys = entries.flatMap((e) => e.clientRequestId ?? []);
      const existing = await tx.financeEntry.findMany({
        where: { userId, clientRequestId: { in: keys } },
        select: { clientRequestId: true },
      });
      const done = new Set(existing.map((e) => e.clientRequestId));
      const missing = entries.filter(
        (e) => !e.clientRequestId || !done.has(e.clientRequestId),
      );
      const count = await tx.financeEntry.count({ where: { userId } });
      if (count + missing.length > MAX_FINANCE_ENTRIES_PER_USER) {
        throw new BadRequestException(
          `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
        );
      }
      // Uma conta apagada entretanto (ou de outra pessoa) fica sem ligacao.
      const owned = await tx.financeAccount.findMany({
        where: { userId },
        select: { id: true },
      });
      const accounts = new Set(owned.map((a) => a.id));
      for (const entry of missing) {
        const created = await tx.financeEntry.create({
          data: this.entryData(userId, entry, accounts),
          select: { id: true },
        });
        if (entry.debtPaymentIds?.length) {
          await tx.financeOwedPayment.updateMany({
            where: {
              id: { in: entry.debtPaymentIds },
              userId,
              entryId: null,
            },
            data: { entryId: created.id },
          });
        }
        if (entry.incomePaymentId) {
          await tx.financeOwedPayment.updateMany({
            where: {
              id: entry.incomePaymentId,
              userId,
              incomeEntryId: null,
            },
            data: { incomeEntryId: created.id },
          });
        }
      }
      return { restored: missing.length };
    });
  }

  private entryData(
    userId: string,
    entry: RestoreFinanceEntryDto,
    accounts: Set<string>,
  ): Prisma.FinanceEntryUncheckedCreateInput {
    // Uma divida ja recebida pode ter prazo anterior a `date` (dia em que
    // pagaram): como ja estava gravada, as datas nao se voltam a comparar.
    const receivedAt = entry.receivedAt
      ? parseDay(entry.receivedAt, 'receivedAt')
      : null;
    const rule = resolveRule(
      { ...entry, recurring: undefined },
      {
        date: new Date(0),
        frequency: null,
        payDayRule: null,
        payDay: null,
        endDate: null,
        kind: entry.kind,
      },
    );
    const owed = resolveOwed(entry, { kind: entry.kind, receivedAt }, rule);
    return {
      userId,
      clientRequestId: entry.clientRequestId ?? null,
      kind: entry.kind,
      amountCents: entry.amountCents,
      category: entry.category,
      note: entry.note || null,
      accountId:
        entry.accountId && accounts.has(entry.accountId)
          ? entry.accountId
          : null,
      ...rule,
      ...owed,
    };
  }

  // Idempotente pela chave (id antigo): repetir com mais ids so religa mais.
  async restoreAccount(userId: string, dto: RestoreFinanceAccountDto) {
    const { clientRequestId, entryIds, holdingIds, ...fields } = dto;
    if (!clientRequestId) {
      throw new BadRequestException('clientRequestId is required.');
    }
    return this.prisma.$transaction(async (tx) => {
      let account = await tx.financeAccount.findFirst({
        where: { userId, clientRequestId },
      });
      if (!account) {
        const count = await tx.financeAccount.count({ where: { userId } });
        if (count >= MAX_FINANCE_ACCOUNTS_PER_USER) {
          throw new BadRequestException(
            `You can have at most ${MAX_FINANCE_ACCOUNTS_PER_USER} accounts.`,
          );
        }
        account = await tx.financeAccount.create({
          data: {
            userId,
            clientRequestId,
            name: fields.name,
            type: fields.type,
            balanceCents: fields.balanceCents ?? 0,
            currency: fields.currency ?? null,
          },
        });
      }
      const accountId = account.id;
      if (entryIds?.length) {
        await tx.financeEntry.updateMany({
          where: { id: { in: entryIds }, userId, accountId: null },
          data: { accountId },
        });
      }
      if (holdingIds?.length) {
        await tx.financeHolding.updateMany({
          where: { id: { in: holdingIds }, userId, accountId: null },
          data: { accountId },
        });
      }
      return account;
    });
  }
}
