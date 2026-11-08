import { useCallback, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  FINANCE_IMPORT_MAX_ROWS,
  FINANCE_MAX_ENTRIES_PER_USER,
  HTTP_TOO_MANY_REQUESTS,
  getFinanceExport,
  importFinanceEntries,
  type FinanceImportResult,
} from '../api/financeService';
import { chunkImportRows, countDuplicates, parseFinanceCsv, type FinanceImportParse } from '../utils/financeCsv';
import { newRequestId } from '../lib/idempotency';

// Ficheiro maior do que isto nem e lido (5000 linhas do export ficam longe).
export const FINANCE_IMPORT_MAX_FILE_MB = 2;
const BYTES_PER_MB = 1024 * 1024;
// Abaixo do teto de 100kb do body JSON no backend (Express), com folga.
const IMPORT_MAX_BODY_BYTES = 90_000;

export type FinanceImportStage = 'idle' | 'reading' | 'preview' | 'importing' | 'done' | 'error';

export interface FinanceImportPreview extends FinanceImportParse {
  duplicates: number;
  /** Linhas novas (validas e nao duplicadas). */
  fresh: number;
  /** Quantas entradas ainda cabem no teto por pessoa. */
  room: number;
}

export interface FinanceImportProgress {
  sent: number;
  total: number;
}

// Chave i18n (financeImport.error.<chave>).
export type FinanceImportErrorKey = 'tooLarge' | 'read' | 'load' | 'import' | 'rateLimited';

export function useFinanceImport() {
  const [stage, setStage] = useState<FinanceImportStage>('idle');
  const [preview, setPreview] = useState<FinanceImportPreview | null>(null);
  const [progress, setProgress] = useState<FinanceImportProgress>({ sent: 0, total: 0 });
  const [result, setResult] = useState<FinanceImportResult | null>(null);
  const [errorKey, setErrorKey] = useState<FinanceImportErrorKey | null>(null);

  const fail = useCallback((key: FinanceImportErrorKey) => {
    setErrorKey(key);
    setStage('error');
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setPreview(null);
    setResult(null);
    setErrorKey(null);
    setProgress({ sent: 0, total: 0 });
  }, []);

  // Le o ficheiro e compara com o que ja existe (GET /finance/export).
  const pickFile = useCallback(
    async (file: File) => {
      reset();
      if (file.size > FINANCE_IMPORT_MAX_FILE_MB * BYTES_PER_MB) return fail('tooLarge');
      setStage('reading');
      let parsed: FinanceImportParse;
      try {
        parsed = parseFinanceCsv(await file.text());
      } catch {
        return fail('read');
      }
      try {
        const existing = await getFinanceExport();
        const duplicates = countDuplicates(parsed.rows, existing.entries);
        const room = existing.truncated ? 0 : Math.max(0, FINANCE_MAX_ENTRIES_PER_USER - existing.entries.length);
        setPreview({ ...parsed, duplicates, fresh: parsed.rows.length - duplicates, room });
        setStage('preview');
      } catch {
        fail('load');
      }
    },
    [reset, fail],
  );

  // Manda todas as linhas validas (o backend volta a saltar os duplicados e
  // corta no teto), em lotes sequenciais, cada um com a sua chave.
  // Devolve o total (tambem parcial, se um lote falhar).
  const confirm = useCallback(async (): Promise<FinanceImportResult | null> => {
    if (!preview) return null;
    const chunks = chunkImportRows(preview.rows, FINANCE_IMPORT_MAX_ROWS, IMPORT_MAX_BODY_BYTES);
    const total: FinanceImportResult = { imported: 0, skipped: 0 };
    setStage('importing');
    setProgress({ sent: 0, total: preview.rows.length });
    try {
      for (const chunk of chunks) {
        const res = await importFinanceEntries(chunk, newRequestId());
        total.imported += res.imported;
        total.skipped += res.skipped;
        setProgress((p) => ({ ...p, sent: p.sent + chunk.length }));
      }
      setResult(total);
      setStage('done');
    } catch (err) {
      setResult(total);
      fail(isAxiosError(err) && err.response?.status === HTTP_TOO_MANY_REQUESTS ? 'rateLimited' : 'import');
    }
    return total;
  }, [preview, fail]);

  return { stage, preview, progress, result, errorKey, pickFile, confirm, reset };
}
