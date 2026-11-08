import { describe, expect, it } from 'vitest';
import { chunkImportRows, countDuplicates, financeToCsv, OWED_PAYMENT_KIND, parseFinanceCsv } from './financeCsv';
import type { FinanceExport, FinanceExportEntry, FinanceImportRow } from '../api/financeService';

const labels = { headers: ['date', 'kind', 'category', 'amount', 'note', 'account', 'repeats', 'isOwed', 'debtor', 'received'], paymentNote: 'Payment' };

const base: FinanceExport = {
  currency: 'EUR',
  truncated: false,
  accounts: [{ id: 'a1', name: 'Bank, main' }],
  entries: [
    { id: 'e1', kind: 'EXPENSE', amountCents: 1250, category: 'FOOD', note: '=HYPERLINK("x")', date: '2026-03-05', frequency: 'MONTHLY', accountId: 'a1', isOwed: false, debtorName: null, receivedAt: null },
    { id: 'e2', kind: 'INCOME', amountCents: 5000, category: 'OTHER', note: '-1+2', date: '2026-03-01', frequency: null, accountId: null, isOwed: true, debtorName: '@Ana', receivedAt: null },
  ],
  owedPayments: [{ id: 'p1', entryId: 'e2', debtorName: 'Ana', amountCents: 500, paidAt: '2026-04-01' }],
};

describe('financeToCsv', () => {
  const lines = financeToCsv(base, labels).replace('﻿', '').trimEnd().split('\n');

  it('starts with a BOM and the header', () => {
    expect(financeToCsv(base, labels).startsWith('﻿date,kind')).toBe(true);
  });

  it('writes decimals, account names and quotes commas', () => {
    expect(lines[1]).toBe(`2026-03-05,EXPENSE,FOOD,12.50,"'=HYPERLINK(""x"")","Bank, main",MONTHLY,false,,`);
  });

  it('neutralizes formula prefixes in notes and debtor names', () => {
    expect(lines[2]).toContain("'-1+2");
    expect(lines[2]).toContain("'@Ana");
  });

  it('adds one informational OWED_PAYMENT row per partial payment', () => {
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('2026-04-01,OWED_PAYMENT,,5.00,Payment,,,true,Ana,2026-04-01');
  });

  it('does not count a partial payment twice in a Kind=INCOME sum', () => {
    // The payment already created its own INCOME entry (e3).
    const data: FinanceExport = {
      ...base,
      entries: [...base.entries, { id: 'e3', kind: 'INCOME', amountCents: 500, category: 'OTHER', note: 'Ana', date: '2026-04-01', frequency: null, accountId: null, isOwed: false, debtorName: null, receivedAt: null }],
    };
    const rows = financeToCsv(data, labels).replace(/^﻿/, '').trimEnd().split('\n').slice(1);
    const incomeSum = rows.map((r) => r.split(',')).filter((c) => c[1] === 'INCOME' && c[7] === 'false').reduce((sum, c) => sum + Number(c[3]), 0);
    expect(incomeSum).toBe(5);
    expect(rows.filter((r) => r.split(',')[1] === OWED_PAYMENT_KIND)).toHaveLength(1);
  });
});

const HEADER = 'Date,Kind,Category,Amount,Note,Account,Repeats,Owed to me,Debtor,Received on';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('parseFinanceCsv', () => {
  it('round-trips the export (BOM, quotes, apostrophe prefix, account names)', () => {
    const parsed = parseFinanceCsv(financeToCsv(base, labels));
    expect(parsed.rows).toEqual([
      { kind: 'EXPENSE', amountCents: 1250, category: 'FOOD', date: '2026-03-05', note: '=HYPERLINK("x")', frequency: 'MONTHLY', accountName: 'Bank, main' },
      { kind: 'INCOME', amountCents: 5000, category: 'OTHER', date: '2026-03-01', note: '-1+2' },
    ]);
    expect(parsed.errors).toEqual([]);
  });

  it('skips OWED_PAYMENT rows as informational and counts owed rows imported as plain', () => {
    const parsed = parseFinanceCsv(financeToCsv(base, labels));
    expect(parsed.informational).toBe(1);
    expect(parsed.owedAsPlain).toBe(1);
  });

  it('reads CRLF files and a translated header', () => {
    const text = '\uFEFFData,Tipo,Categoria,Valor\r\n2026-01-02,expense,food,3.00\r\n';
    expect(parseFinanceCsv(text).rows).toEqual([{ kind: 'EXPENSE', amountCents: 300, category: 'FOOD', date: '2026-01-02' }]);
  });

  it('accepts 1.50 and a quoted 1,50 as the same amount', () => {
    const { rows, errors } = parseFinanceCsv(csv('2026-01-02,EXPENSE,CAFE,1.50', '2026-01-02,EXPENSE,CAFE,"1,50"'));
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.amountCents)).toEqual([150, 150]);
  });

  it('rejects an unquoted 1,50 (it shifts the columns)', () => {
    const { rows, errors } = parseFinanceCsv(csv('2026-01-02,EXPENSE,CAFE,1,50,Note,,,false,,'));
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 2, error: 'COLUMNS' }]);
  });

  it.each([
    ['0.00', 'AMOUNT'],
    ['-1.50', 'AMOUNT'],
    ['1.505', 'AMOUNT'],
    ['"1.234,50"', 'AMOUNT'],
    ['abc', 'AMOUNT'],
  ])('rejects amount %s', (amount, error) => {
    expect(parseFinanceCsv(csv(`2026-01-02,EXPENSE,CAFE,${amount}`)).errors).toEqual([{ row: 2, error }]);
  });

  it('reports row numbers and reasons for bad rows', () => {
    const { rows, errors } = parseFinanceCsv(
      csv(
        '2026-02-31,EXPENSE,CAFE,1.00',
        '2026-01-02,REFUND,CAFE,1.00',
        '2026-01-02,EXPENSE,PIZZA,1.00',
        `2026-01-02,EXPENSE,CAFE,1.00,${'x'.repeat(121)}`,
        '2026-01-02,EXPENSE,CAFE,1.00,,,DAILY',
        '2026-01-02,EXPENSE',
        '2026-01-03,INCOME,SALARY,900.00,,,monthly',
      ),
    );
    expect(errors).toEqual([
      { row: 2, error: 'DATE' },
      { row: 3, error: 'KIND' },
      { row: 4, error: 'CATEGORY' },
      { row: 5, error: 'NOTE' },
      { row: 6, error: 'REPEATS' },
      { row: 7, error: 'COLUMNS' },
    ]);
    expect(rows).toEqual([{ kind: 'INCOME', amountCents: 90000, category: 'SALARY', date: '2026-01-03', frequency: 'MONTHLY' }]);
  });

  it('returns nothing for an empty file or a header only', () => {
    expect(parseFinanceCsv('')).toEqual({ rows: [], errors: [], informational: 0, owedAsPlain: 0 });
    expect(parseFinanceCsv(HEADER).rows).toEqual([]);
  });
});

const entry = (over: Partial<FinanceExportEntry> = {}): FinanceExportEntry => ({
  id: 'x',
  kind: 'EXPENSE',
  amountCents: 150,
  category: 'CAFE',
  note: null,
  date: '2026-01-02',
  frequency: null,
  accountId: null,
  isOwed: false,
  debtorName: null,
  receivedAt: null,
  ...over,
});
const coffee: FinanceImportRow = { kind: 'EXPENSE', amountCents: 150, category: 'CAFE', date: '2026-01-02' };

describe('countDuplicates', () => {
  it('counts as a multiset and treats an empty note as no note', () => {
    expect(countDuplicates([coffee, coffee, { ...coffee, note: 'x' }], [entry()])).toBe(1);
    expect(countDuplicates([coffee], [entry({ note: 'x' })])).toBe(0);
  });
});

describe('chunkImportRows', () => {
  it('respects the row cap and keeps identical rows in the same chunk', () => {
    const tea = { ...coffee, category: 'FOOD' };
    const chunks = chunkImportRows([coffee, tea, coffee, tea, { ...coffee, amountCents: 1 }], 3, 10_000);
    expect(chunks.map((c) => c.length)).toEqual([2, 3]);
    expect(chunks[0]).toEqual([coffee, coffee]);
  });

  it('respects the byte cap and splits a group bigger than a chunk', () => {
    const size = JSON.stringify(coffee).length + 1;
    const chunks = chunkImportRows([coffee, coffee, coffee], 10, size * 2);
    expect(chunks.map((c) => c.length)).toEqual([2, 1]);
  });
});
