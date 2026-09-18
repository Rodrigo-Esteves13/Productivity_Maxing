import { useState } from 'react';
import { importSchedule } from '../api/scheduleService';
import { parseIcsSchedule } from '../utils/parseIcsSchedule';
import type { ImportScheduleResult } from '../types/models';

export type ScheduleImportStage = 'idle' | 'reading' | 'importing' | 'done' | 'error';

export interface ScheduleImportOutcome {
  parseErrors: string[];
  backendResult: ImportScheduleResult | null;
}

// Mesma orquestração de useTaskImport.ts, adaptada a .ics: ler o
// ficheiro -> parseIcsSchedule (client-side, ver utils/parseIcsSchedule.ts)
// -> POST /schedule/import -> juntar erros de parsing e de backend num só
// sítio para o modal renderizar.
export function useScheduleImport() {
  const [stage, setStage] = useState<ScheduleImportStage>('idle');
  const [outcome, setOutcome] = useState<ScheduleImportOutcome | null>(null);
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
      const text = await file.text();
      const { rows, errors: parseErrors } = parseIcsSchedule(text);

      if (rows.length === 0) {
        setOutcome({ parseErrors, backendResult: null });
        setStage('error');
        return;
      }

      setStage('importing');
      const backendResult = await importSchedule(rows);
      setOutcome({ parseErrors, backendResult });
      setStage('done');
    } catch (err) {
      console.error('Schedule import failed:', err);
      setErrorMessage("Couldn't read or import that file. Make sure it's a valid .ics export.");
      setStage('error');
    }
  };

  return { stage, outcome, errorMessage, runImport, reset };
}
