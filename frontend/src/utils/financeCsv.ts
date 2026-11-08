import {
  FINANCE_ACCOUNT_NAME_MAX_LENGTH,
  FINANCE_CATEGORIES,
  FINANCE_FREQUENCIES,
  FINANCE_MAX_AMOUNT_CENTS,
  FINANCE_NOTE_MAX_LENGTH,
  type FinanceEntryKind,
  type FinanceExport,
  type FinanceExportEntry,
  type FinanceFrequency,
  type FinanceImportRow,
} from '../api/financeService';
import { centsToInput, parseMoneyInput } from '../lib/money';
import { escapeCsvField } from './taskExportFormats';
import { parseCsv, unneutralizeFormulaPrefix } from './csvParse';

// Ordem das colunas do CSV. Os cabecalhos sao traduzidos, por isso a
// importacao le por posicao e nao pelo nome.
export const FINANCE_CSV_COLUMNS = ['date', 'kind', 'category', 'amount', 'note', 'account', 'repeats', 'isOwed', 'debtor', 'received'] as const;
type FinanceCsvColumn = (typeof FINANCE_CSV_COLUMNS)[number];
const COL = Object.fromEntries(FINANCE_CSV_COLUMNS.map((key, i) => [key, i])) as Record<FinanceCsvColumn, number>;

// Excel only reads UTF-8 (ja, ko, zh, accents) when the file starts with a BOM.
const UTF8_BOM = '﻿';
const BOOL_TRUE = 'true';
const BOOL_FALSE = 'false';
// Kind of the partial payment rows. Each payment already created its own
// INCOME entry (exported above), so these rows are informational: a
// different Kind keeps a Kind=INCOME sum from counting the money twice.
export const OWED_PAYMENT_KIND = 'OWED_PAYMENT';

export interface FinanceCsvLabels {
  headers: string[];
  /** Note written on rows that are a partial payment of an owed entry. */
  paymentNote: string;
}

// One row per entry (a recurring rule is one row, with its frequency) plus one
// per partial payment received (Kind OWED_PAYMENT, see above). Amounts are
// decimals in the settings currency.
export function financeToCsv(data: FinanceExport, labels: FinanceCsvLabels): string {
  const accountNames = new Map(data.accounts.map((a) => [a.id, a.name]));
  const lines = [labels.headers.map(escapeCsvField).join(',')];
  const push = (cells: string[]) => lines.push(cells.map(escapeCsvField).join(','));
  for (const e of data.entries) {
    push([
      e.date,
      e.kind,
      e.category,
      centsToInput(e.amountCents),
      e.note ?? '',
      e.accountId ? (accountNames.get(e.accountId) ?? '') : '',
      e.frequency ?? '',
      e.isOwed ? BOOL_TRUE : BOOL_FALSE,
      e.debtorName ?? '',
      e.receivedAt ?? '',
    ]);
  }
  for (const p of data.owedPayments) {
    push([p.paidAt, OWED_PAYMENT_KIND, '', centsToInput(p.amountCents), labels.paymentNote, '', '', BOOL_TRUE, p.debtorName ?? '', p.paidAt]);
  }
  return UTF8_BOM + lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Importacao (o inverso de financeToCsv)

// Ate a coluna Amount e obrigatorio; as seguintes podem faltar.
const MIN_IMPORT_COLUMNS = COL.amount + 1;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const IMPORT_KINDS: readonly string[] = ['INCOME', 'EXPENSE'] satisfies FinanceEntryKind[];
const CATEGORIES: readonly string[] = FINANCE_CATEGORIES;
const FREQUENCIES: readonly string[] = FINANCE_FREQUENCIES;

/** Motivo de uma linha rejeitada (chave i18n financeImport.reason.<motivo>). */
export const FINANCE_IMPORT_ERRORS = ['COLUMNS', 'DATE', 'KIND', 'CATEGORY', 'AMOUNT', 'NOTE', 'REPEATS', 'ACCOUNT'] as const;
export type FinanceImportError = (typeof FINANCE_IMPORT_ERRORS)[number];

export interface FinanceImportParse {
  /** Linhas validas, pela ordem do ficheiro. */
  rows: FinanceImportRow[];
  /** row = numero da linha no ficheiro (1 = cabecalho). */
  errors: { row: number; error: FinanceImportError }[];
  /** Linhas OWED_PAYMENT: so informativas, saltadas. */
  informational: number;
  /** Linhas validas marcadas "devem-me": entram como entradas simples. */
  owedAsPlain: number;
}

function isRealDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function readRow(cells: string[]): FinanceImportRow | FinanceImportError {
  if (cells.length < MIN_IMPORT_COLUMNS || cells.length > FINANCE_CSV_COLUMNS.length) return 'COLUMNS';
  const cell = (column: FinanceCsvColumn) => unneutralizeFormulaPrefix(cells[COL[column]] ?? '').trim();
  const date = cell('date');
  if (!isRealDateKey(date)) return 'DATE';
  const kind = cell('kind').toUpperCase();
  if (!IMPORT_KINDS.includes(kind)) return 'KIND';
  const category = cell('category').toUpperCase();
  if (!CATEGORIES.includes(category)) return 'CATEGORY';
  const amountCents = parseMoneyInput(cell('amount'));
  if (amountCents === null || amountCents < 1 || amountCents > FINANCE_MAX_AMOUNT_CENTS) return 'AMOUNT';
  const note = cell('note');
  if (note.length > FINANCE_NOTE_MAX_LENGTH) return 'NOTE';
  const repeats = cell('repeats').toUpperCase();
  if (repeats && !FREQUENCIES.includes(repeats)) return 'REPEATS';
  const account = cell('account');
  if (account.length > FINANCE_ACCOUNT_NAME_MAX_LENGTH) return 'ACCOUNT';
  return {
    kind: kind as FinanceEntryKind,
    amountCents,
    category,
    date,
    ...(note && { note }),
    ...(repeats && { frequency: repeats as FinanceFrequency }),
    ...(account && { accountName: account }),
  };
}

/**
 * Le o CSV do export: a primeira linha e o cabecalho quando a primeira
 * celula nao e uma data. Linhas OWED_PAYMENT sao saltadas (informativas).
 */
export function parseFinanceCsv(text: string): FinanceImportParse {
  const result: FinanceImportParse = { rows: [], errors: [], informational: 0, owedAsPlain: 0 };
  parseCsv(text).forEach((cells, index) => {
    const first = (cells[COL.date] ?? '').trim();
    if (index === 0 && !DATE_KEY_PATTERN.test(first)) return;
    if ((cells[COL.kind] ?? '').trim().toUpperCase() === OWED_PAYMENT_KIND) {
      result.informational += 1;
      return;
    }
    const row = readRow(cells);
    if (typeof row === 'string') {
      result.errors.push({ row: index + 1, error: row });
      return;
    }
    result.rows.push(row);
    if ((cells[COL.isOwed] ?? '').trim().toLowerCase() === BOOL_TRUE) result.owedAsPlain += 1;
  });
  return result;
}

/** Mesma chave de duplicado do backend (importDedupeKey): dia, tipo, categoria, valor e nota. */
export function financeDedupeKey(row: { date: string; kind: string; category: string; amountCents: number; note?: string | null }): string {
  return JSON.stringify([row.date, row.kind, row.category, row.amountCents, row.note ?? '']);
}

/**
 * Quantas linhas ja existem (multiconjunto: duas linhas iguais no ficheiro
 * contra uma na base contam uma como duplicada). So para a pre-visualizacao:
 * o backend volta a fazer a mesma conta.
 */
export function countDuplicates(rows: FinanceImportRow[], existing: FinanceExportEntry[]): number {
  const left = new Map<string, number>();
  for (const e of existing) {
    const key = financeDedupeKey(e);
    left.set(key, (left.get(key) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const row of rows) {
    const key = financeDedupeKey(row);
    const n = left.get(key) ?? 0;
    if (n > 0) {
      left.set(key, n - 1);
      duplicates += 1;
    }
  }
  return duplicates;
}

const encoder = new TextEncoder();
// +1 pela virgula entre linhas no JSON do pedido.
const rowBytes = (row: FinanceImportRow) => encoder.encode(JSON.stringify(row)).length + 1;

/**
 * Parte as linhas em pedidos (teto de linhas e de bytes do body). Linhas
 * iguais vao no mesmo pedido: o backend conta duplicados contra o que ja
 * existe, e um lote anterior com a mesma linha fazia saltar a segunda.
 * So um grupo maior do que um pedido inteiro e partido.
 */
export function chunkImportRows(rows: FinanceImportRow[], maxRows: number, maxBytes: number): FinanceImportRow[][] {
  const groups = new Map<string, FinanceImportRow[]>();
  for (const row of rows) {
    const key = financeDedupeKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const chunks: FinanceImportRow[][] = [];
  let current: FinanceImportRow[] = [];
  let bytes = 0;
  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = [];
    bytes = 0;
  };
  const add = (row: FinanceImportRow, size: number) => {
    current.push(row);
    bytes += size;
  };
  for (const group of groups.values()) {
    const sizes = group.map(rowBytes);
    const groupBytes = sizes.reduce((a, b) => a + b, 0);
    const fitsAlone = group.length <= maxRows && groupBytes <= maxBytes;
    if (fitsAlone) {
      if (current.length + group.length > maxRows || bytes + groupBytes > maxBytes) flush();
      group.forEach((row, i) => add(row, sizes[i]));
      continue;
    }
    group.forEach((row, i) => {
      if (current.length + 1 > maxRows || bytes + sizes[i] > maxBytes) flush();
      add(row, sizes[i]);
    });
  }
  flush();
  return chunks;
}
