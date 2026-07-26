import type { Area, AcademicTaskTypeOption, Task } from '../types/models';
import { formatEnumLabel } from './formatEnumLabel';
import { resolveOptionLabel } from './resolveOptionLabel';

// Shared column set for both CSV and Markdown exports, so the two formats
// never silently drift apart (one gaining a column the other doesn't have).
const EXPORT_COLUMNS = [
  'Title',
  'Area',
  'Type',
  'Date',
  'Difficulty',
  'Status',
  'Weight %',
  'Target Grade',
  'Real Grade',
  'Topics',
] as const;

function areaName(areaId: string, areas: Area[]): string {
  return areas.find((a) => a.id === areaId)?.name ?? 'Unknown area';
}

function taskDateOnly(isoDate: string): string {
  return isoDate.split('T')[0] ?? isoDate;
}

function toRow(
  task: Task,
  areas: Area[],
  academicTaskTypes: AcademicTaskTypeOption[],
): string[] {
  return [
    task.title,
    areaName(task.areaId, areas),
    resolveOptionLabel(task.academicType, academicTaskTypes) ?? '-',
    taskDateOnly(task.date),
    formatEnumLabel(task.difficulty),
    formatEnumLabel(task.progressStatus),
    task.weightPercentage !== null ? String(task.weightPercentage) : '',
    task.targetGrade !== null ? String(task.targetGrade) : '',
    task.realGrade !== null ? String(task.realGrade) : '',
    task.topics ?? '',
  ];
}

// RFC 4180-style escaping: a field is quoted if it contains a comma, a
// quote, or a newline, and any quote inside it is doubled. Plain fields
// (the vast majority: titles, area names, single-word statuses) are left
// unquoted for a cleaner file, which is valid CSV either way.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tasksToCsv(
  tasks: Task[],
  areas: Area[],
  academicTaskTypes: AcademicTaskTypeOption[],
): string {
  const lines = [EXPORT_COLUMNS.map(escapeCsvField).join(',')];
  for (const task of tasks) {
    lines.push(toRow(task, areas, academicTaskTypes).map(escapeCsvField).join(','));
  }
  // Trailing newline: a CSV file without one is still valid, but several
  // spreadsheet tools warn about a "missing" final line without it.
  return lines.join('\n') + '\n';
}

// A pipe cell is escaped by replacing '|' with the HTML entity - the only
// character that would otherwise break a Markdown table row.
function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function tasksToMarkdown(
  tasks: Task[],
  areas: Area[],
  academicTaskTypes: AcademicTaskTypeOption[],
): string {
  const header = `| ${EXPORT_COLUMNS.join(' | ')} |`;
  const divider = `| ${EXPORT_COLUMNS.map(() => '---').join(' | ')} |`;
  const rows = tasks.map((task) => {
    const cells = toRow(task, areas, academicTaskTypes).map(escapeMarkdownCell);
    return `| ${cells.join(' | ')} |`;
  });

  const generatedAt = new Date().toISOString().split('T')[0];
  return [
    `# Task export (${generatedAt})`,
    '',
    `${tasks.length} task(s).`,
    '',
    header,
    divider,
    ...rows,
  ].join('\n') + '\n';
}
