import { escapeCsvField } from '../utils/taskExportFormats';
import type { MedicationHistory } from '../types/models';

export interface MedHistoryCsvLabels {
  date: string;
  scheduled: string;
  taken: string;
}

// CSV do historico diario de adesao: uma linha por dia (tomas planeadas e
// tomadas). So conta, nao avalia. Campos escapados pela funcao partilhada.
export function medHistoryToCsv(history: MedicationHistory, labels: MedHistoryCsvLabels): string {
  const lines = [[labels.date, labels.scheduled, labels.taken].map(escapeCsvField).join(',')];
  for (const day of history.days) {
    lines.push([day.date, String(day.scheduled), String(day.taken)].map(escapeCsvField).join(','));
  }
  return lines.join('\n') + '\n';
}

// Percentagem de um dia para o rotulo da barra; null quando nao ha tomas planeadas.
const PERCENT = 100;
export function dayPercent(taken: number, scheduled: number): number | null {
  return scheduled === 0 ? null : Math.min(PERCENT, Math.round((taken / scheduled) * PERCENT));
}
