import { useState } from 'react';
import { getUserAreas, getTaskMetadata, importTasks } from '../api/userService';
import { getPrograms, getProgramPeriods } from '../api/academicService';
import { parseSpreadsheetFile, mapImportRows } from '../utils/parseTaskImportFile';
import type { AcademicPeriod, ImportTasksResult } from '../types/models';
import { translateNow } from '../i18n/translate';

export type ImportStage = 'idle' | 'reading' | 'importing' | 'done' | 'error';

// Must match the backend's @ArrayMaxSize(500) on ImportTasksDto.rows (see
// backend/src/tasks/dto/import-tasks.dto.ts). Checked here too so an
// oversized spreadsheet fails fast with a clear message instead of
// spending a full parse + upload only to be rejected by the backend.
const MAX_IMPORT_ROWS = 500;

export interface ParseError {
  row: number;
  message: string;
}

export interface ImportOutcome {
  parseErrors: ParseError[];
  backendResult: ImportTasksResult | null;
}

// Orchestrates: fetch the user's Areas + task-type catalog -> parse the
// uploaded spreadsheet -> map its human-readable columns to backend IDs/keys
// -> POST the well-formed rows -> surface both parse-time and backend
// per-row results together, so the modal has one place to render from.
export function useTaskImport() {
  const [stage, setStage] = useState<ImportStage>('idle');
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = () => {
    setStage('idle');
    setOutcome(null);
    setErrorMessage(null);
  };

  const runImport = async (file: File) => {
    setStage('reading');
    setErrorMessage(null);
    setOutcome(null);

    try {
      const [areas, meta, programs] = await Promise.all([
        getUserAreas(),
        getTaskMetadata(),
        getPrograms(),
      ]);
      // Periods are program-scoped (no "all periods across all programs"
      // endpoint), so flatten them here - a Period name only needs to be
      // unique enough for findPeriodByName() to match it, regardless of
      // which program it belongs to.
      const periodLists = await Promise.all(programs.map((p) => getProgramPeriods(p.id)));
      const periods: AcademicPeriod[] = periodLists.flat();

      const rawRows = await parseSpreadsheetFile(file);

      if (rawRows.length === 0) {
        setErrorMessage(translateNow('hook.thatFileHasNoRowsTo'));
        setStage('error');
        return;
      }

      const { rows, errors: parseErrors } = mapImportRows(rawRows, areas, meta, periods);

      if (rows.length === 0) {
        setOutcome({ parseErrors, backendResult: null });
        setStage('error');
        return;
      }

      if (rows.length > MAX_IMPORT_ROWS) {
        setErrorMessage(
          translateNow('hook.importTooManyRows', { rows: rows.length, max: MAX_IMPORT_ROWS }),
        );
        setStage('error');
        return;
      }

      setStage('importing');
      const backendResult = await importTasks(rows);
      setOutcome({ parseErrors, backendResult });
      setStage('done');
    } catch (err) {
      console.error('Task import failed:', err);
      setErrorMessage(
        translateNow('hook.taskImportFailed'),
      );
      setStage('error');
    }
  };

  return { stage, outcome, errorMessage, runImport, reset };
}
