// Desfazer um pagamento parcial de "devem-me dinheiro". Puro (sem Prisma
// client nem relogio): copia da divida guardada no pagamento que a saldou
// (a divida e apagada nesse momento) e leitura defensiva dessa copia.

import {
  FinanceEntryKind,
  FinanceInterestKind,
  Prisma,
  type FinanceEntry,
} from '@prisma/client';
import { SETTLED_DEBT_SNAPSHOT_VERSION } from './finance.constants';

/**
 * Campos da divida apagada ao saldar, para a repor tal como estava. `type`
 * (nao interface) para ser aceite como Prisma.InputJsonValue sem cast.
 */
export type SettledDebtSnapshot = {
  v: typeof SETTLED_DEBT_SNAPSHOT_VERSION;
  /** id original: os pagamentos anteriores voltam a apontar para ele. */
  id: string;
  category: string;
  note: string | null;
  debtorName: string | null;
  /** ISO. Dia do emprestimo (inicio dos juros). */
  date: string;
  expectedDate: string | null;
  latePaymentRiskPct: number | null;
  /** Decimal como texto (ex.: "4.500"). */
  interestRatePct: string | null;
  interestKind: FinanceInterestKind | null;
  accountId: string | null;
  /** Pagamentos anteriores desta divida (o SetNull tira-lhes o entryId). */
  paymentIds: string[];
};

export type SettledDebtSource = Pick<
  FinanceEntry,
  | 'id'
  | 'category'
  | 'note'
  | 'debtorName'
  | 'date'
  | 'expectedDate'
  | 'latePaymentRiskPct'
  | 'interestRatePct'
  | 'interestKind'
  | 'accountId'
>;

export function buildSettledDebtSnapshot(
  debt: SettledDebtSource,
  paymentIds: string[],
): SettledDebtSnapshot {
  return {
    v: SETTLED_DEBT_SNAPSHOT_VERSION,
    id: debt.id,
    category: debt.category,
    note: debt.note,
    debtorName: debt.debtorName,
    date: debt.date.toISOString(),
    expectedDate: debt.expectedDate ? debt.expectedDate.toISOString() : null,
    latePaymentRiskPct: debt.latePaymentRiskPct,
    interestRatePct:
      debt.interestRatePct === null ? null : debt.interestRatePct.toString(),
    interestKind: debt.interestKind,
    accountId: debt.accountId,
    paymentIds,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNullableString = (v: unknown): v is string | null =>
  v === null || typeof v === 'string';
const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v));
const INTEREST_KINDS: readonly unknown[] = Object.values(FinanceInterestKind);

/**
 * Le a copia guardada. Qualquer campo em falta ou de outro tipo (ou outra
 * versao) da null: o desfazer apaga o pagamento mas nao repoe a divida.
 */
export function parseSettledDebtSnapshot(
  raw: unknown,
): SettledDebtSnapshot | null {
  if (!isObject(raw) || raw.v !== SETTLED_DEBT_SNAPSHOT_VERSION) return null;
  const ok =
    typeof raw.id === 'string' &&
    typeof raw.category === 'string' &&
    isNullableString(raw.note) &&
    isNullableString(raw.debtorName) &&
    isIsoDate(raw.date) &&
    (raw.expectedDate === null || isIsoDate(raw.expectedDate)) &&
    (raw.latePaymentRiskPct === null ||
      Number.isInteger(raw.latePaymentRiskPct)) &&
    isNullableString(raw.interestRatePct) &&
    (raw.interestKind === null || INTEREST_KINDS.includes(raw.interestKind)) &&
    isNullableString(raw.accountId) &&
    Array.isArray(raw.paymentIds) &&
    raw.paymentIds.every((p) => typeof p === 'string');
  return ok ? (raw as unknown as SettledDebtSnapshot) : null;
}

/**
 * Linha a recriar: divida aberta (INCOME de uma vez, sem receivedAt) com o
 * principal que o pagamento desfeito tinha saldado. accountId so se a conta
 * ainda existir (quem chama confirma).
 */
export function restoredDebtData(
  snapshot: SettledDebtSnapshot,
  userId: string,
  amountCents: number,
  accountId: string | null,
): Prisma.FinanceEntryUncheckedCreateInput {
  return {
    id: snapshot.id,
    userId,
    kind: FinanceEntryKind.INCOME,
    amountCents,
    category: snapshot.category,
    note: snapshot.note,
    date: new Date(snapshot.date),
    isOwed: true,
    debtorName: snapshot.debtorName,
    expectedDate: snapshot.expectedDate
      ? new Date(snapshot.expectedDate)
      : null,
    latePaymentRiskPct: snapshot.latePaymentRiskPct,
    interestRatePct:
      snapshot.interestRatePct === null
        ? null
        : new Prisma.Decimal(snapshot.interestRatePct),
    interestKind: snapshot.interestKind,
    accountId,
  };
}
