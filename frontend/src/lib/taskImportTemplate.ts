import { escapeCsvField } from '../utils/taskExportFormats';

// CSV modelo da importacao de tarefas. Os cabecalhos sao os nomes ingleses
// que utils/parseTaskImportFile.ts aceita (independentes da lingua da app).
export const TASK_IMPORT_TEMPLATE_FILENAME = 'tasks-import-template.csv';
export const TASK_IMPORT_TEMPLATE_MIME = 'text/csv;charset=utf-8';
// Excel so le UTF-8 (acentos) quando o ficheiro comeca com BOM.
const UTF8_BOM = '﻿';
const CSV_LINE_BREAK = '\r\n';

export const TASK_IMPORT_TEMPLATE_HEADERS = [
  'Title',
  'Date',
  'Area',
  'Period',
  'Type',
  'Weight',
  'Difficulty',
  'Status',
  'Topics',
] as const;
const TASK_IMPORT_TEMPLATE_EXAMPLE = [
  'Chapter 3 exercises',
  '2026-09-30',
  'Calculus',
  '',
  '',
  '',
  'MEDIUM',
  'NOT_STARTED',
  'Limits',
];

export function buildTaskImportTemplateCsv(): string {
  const lines = [TASK_IMPORT_TEMPLATE_HEADERS, TASK_IMPORT_TEMPLATE_EXAMPLE].map((cells) =>
    cells.map(escapeCsvField).join(','),
  );
  return UTF8_BOM + lines.join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}
