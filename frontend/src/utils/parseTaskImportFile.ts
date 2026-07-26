import * as XLSX from 'xlsx';
import type { Area, AcademicPeriod, ImportTaskRow, TaskMeta } from '../types/models';

// Accepted column headers, case-insensitive, with a couple of common
// aliases per column so a spreadsheet built without reading the docs
// still has a decent chance of working. The FIRST match wins per row.
const HEADER_ALIASES: Record<string, string[]> = {
  title: ['title', 'task', 'name'],
  date: ['date', 'due date', 'deadline'],
  area: ['area', 'course', 'subject', 'uc'],
  // Optional - omitted rows fall back to the backend's default (the
  // user's currently active period), same as a manually-created task.
  // Needed for importing HISTORY (past semesters) rather than just the
  // current one, since otherwise every imported row would silently land
  // in whichever period happens to be active right now.
  period: ['period', 'semester'],
  type: ['type', 'task type'],
  academicType: ['academic type', 'subcategory', 'category'],
  weight: ['weight', 'weight %', 'weight percentage'],
  difficulty: ['difficulty'],
  status: ['status', 'progress', 'progress status'],
  targetGrade: ['target grade', 'target'],
  realGrade: ['real grade', 'grade', 'actual grade'],
  topics: ['topics', 'notes', 'description'],
};


export interface ParsedSpreadsheetRow {
  [header: string]: unknown;
}

// Phase 1: read the uploaded file into plain JS objects, one per row,
// keyed by the sheet's own header row - no business logic yet, just
// getting bytes into structured data. `cellDates: true` makes SheetJS
// hand back real JS Date objects for date-formatted cells instead of
// Excel's numeric day-count serials, which is what mapImportRows() below
// expects.
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheetRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { cellDates: true, type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<ParsedSpreadsheetRow>(sheet, { defval: undefined });
}

function findColumnValue(row: ParsedSpreadsheetRow, field: keyof typeof HEADER_ALIASES): unknown {
  const aliases = HEADER_ALIASES[field];
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const matchKey = rowKeys.find((k) => k.trim().toLowerCase() === alias);
    if (matchKey !== undefined && row[matchKey] !== undefined && row[matchKey] !== '') {
      return row[matchKey];
    }
  }
  return undefined;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

// "Very Easy" -> "VERY_EASY", so it can be matched against the enum keys
// TaskMeta returns (the inverse of utils/formatEnumLabel.ts).
function toEnumKey(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function findAreaByName(name: string, areas: Area[]): Area | undefined {
  const normalized = name.trim().toLowerCase();
  return areas.find((a) => a.name.trim().toLowerCase() === normalized);
}

function findPeriodByName(name: string, periods: AcademicPeriod[]): AcademicPeriod | undefined {
  const normalized = name.trim().toLowerCase();
  return periods.find((p) => p.name.trim().toLowerCase() === normalized);
}

function findTaskTypeKeyByLabel(label: string, meta: TaskMeta): string | undefined {
  const normalized = label.trim().toLowerCase();
  return meta.taskTypes.find((t) => t.label.trim().toLowerCase() === normalized)?.key;
}

function findAcademicTypeKeyByLabel(label: string, taskTypeKey: string, meta: TaskMeta): string | undefined {
  const normalized = label.trim().toLowerCase();
  return meta.academicTaskTypes.find(
    (a) => a.taskTypeKey === taskTypeKey && a.label.trim().toLowerCase() === normalized,
  )?.key;
}

export interface MapImportRowsResult {
  rows: ImportTaskRow[];
  // 1-based, matching the row's position in the spreadsheet (header row
  // excluded) - same numbering scheme the backend uses in its response,
  // so a single error list can describe both parse-time and create-time
  // failures without the user having to reconcile two different row counts.
  errors: { row: number; message: string }[];
}

// Phase 2: turn the raw sheet rows into typed, backend-ready ImportTaskRow
// objects - resolving the human-readable Area/Type/Academic Type/Difficulty/
// Status columns against what actually exists (the user's Areas, and the
// task type catalog from GET /tasks/meta). A row that references an Area
// or Type that doesn't exist is reported as an error and left out of
// `rows`, rather than sent to the backend to fail there - catching it here
// gives a clearer message ("Area 'Calc 2' not found - did you mean
// 'Calculus 2'?" territory) than a raw 400 would.
export function mapImportRows(
  rawRows: ParsedSpreadsheetRow[],
  areas: Area[],
  meta: TaskMeta,
  periods: AcademicPeriod[],
): MapImportRowsResult {
  const defaultTaskTypeKey =
    meta.taskTypes.find((t) => t.key === 'ACADEMICO')?.key ?? meta.taskTypes[0]?.key;

  const rows: ImportTaskRow[] = [];
  const errors: { row: number; message: string }[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 1;

    const title = findColumnValue(rawRow, 'title');
    if (typeof title !== 'string' || title.trim() === '') {
      errors.push({ row: rowNumber, message: 'Missing title.' });
      return;
    }

    const isoDate = toIsoDate(findColumnValue(rawRow, 'date'));
    if (!isoDate) {
      errors.push({ row: rowNumber, message: 'Missing or unreadable date.' });
      return;
    }

    const areaName = findColumnValue(rawRow, 'area');
    if (typeof areaName !== 'string' || areaName.trim() === '') {
      errors.push({ row: rowNumber, message: 'Missing area.' });
      return;
    }
    const area = findAreaByName(areaName, areas);
    if (!area) {
      errors.push({ row: rowNumber, message: `Area "${areaName}" doesn't match any of your areas.` });
      return;
    }

    const periodName = findColumnValue(rawRow, 'period');
    let periodId: string | undefined;
    if (typeof periodName === 'string' && periodName.trim() !== '') {
      const period = findPeriodByName(periodName, periods);
      if (!period) {
        errors.push({ row: rowNumber, message: `Period "${periodName}" doesn't match any of your periods.` });
        return;
      }
      periodId = period.id;
    }

    const typeLabel = findColumnValue(rawRow, 'type');
    const typeKey =
      typeof typeLabel === 'string' && typeLabel.trim() !== ''
        ? findTaskTypeKeyByLabel(typeLabel, meta)
        : defaultTaskTypeKey;
    if (!typeKey) {
      errors.push({
        row: rowNumber,
        message:
          typeof typeLabel === 'string' && typeLabel.trim() !== ''
            ? `Type "${typeLabel}" doesn't match any known task type.`
            : 'No task type available.',
      });
      return;
    }

    const academicTypeLabel = findColumnValue(rawRow, 'academicType');
    let academicType: string | undefined;
    if (typeof academicTypeLabel === 'string' && academicTypeLabel.trim() !== '') {
      academicType = findAcademicTypeKeyByLabel(academicTypeLabel, typeKey, meta);
      if (!academicType) {
        errors.push({
          row: rowNumber,
          message: `Academic type "${academicTypeLabel}" doesn't match any known subcategory for that type.`,
        });
        return;
      }
    }

    const difficultyKey = toEnumKey(findColumnValue(rawRow, 'difficulty'));
    if (difficultyKey && !meta.difficulties.includes(difficultyKey)) {
      errors.push({ row: rowNumber, message: `Difficulty "${difficultyKey}" isn't a recognized value.` });
      return;
    }

    const statusKey = toEnumKey(findColumnValue(rawRow, 'status'));
    if (statusKey && !meta.progressStatuses.includes(statusKey)) {
      errors.push({ row: rowNumber, message: `Status "${statusKey}" isn't a recognized value.` });
      return;
    }

    const topicsValue = findColumnValue(rawRow, 'topics');

    rows.push({
      areaId: area.id,
      periodId,
      title: title.trim(),
      date: isoDate,
      type: typeKey,
      academicType,
      topics: typeof topicsValue === 'string' ? topicsValue : undefined,
      weightPercentage: toNumber(findColumnValue(rawRow, 'weight')),
      difficulty: difficultyKey as ImportTaskRow['difficulty'],
      progressStatus: statusKey as ImportTaskRow['progressStatus'],
      targetGrade: toNumber(findColumnValue(rawRow, 'targetGrade')),
      realGrade: toNumber(findColumnValue(rawRow, 'realGrade')),
    });
  });

  return { rows, errors };
}
