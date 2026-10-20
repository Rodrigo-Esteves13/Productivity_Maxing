// Exporta entradas do Notebook para Markdown (Obsidian, Notion, qualquer
// editor). Texto, tabelas, links e o texto escrito no quadro vao inteiros;
// fotos, ficheiros e desenhos nao (os links do Storage expiram numa hora),
// por isso ficam so assinalados.
import type { NotebookEntry, NotebookEntryType, NotebookTable } from '../types/models';
import { foldText } from './textSearch';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const TYPE_LABEL_KEY: Record<NotebookEntryType, string> = {
  CLASS: 'notebook.type.class',
  NOTE: 'notebook.type.note',
  STUDY: 'notebook.type.study',
};

function heading(level: number, text: string): string {
  return `${'#'.repeat(Math.min(level, 6))} ${text}`;
}

// Uma celula nao pode ter "|" nem quebras de linha sem partir a tabela.
function cell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function tableToMarkdown(table: NotebookTable): string | null {
  const width = Math.max(0, ...table.rows.map((row) => row.length));
  if (width === 0 || table.rows.every((row) => row.every((value) => !value.trim()))) return null;
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cell(row[i] ?? '')).join(' | ')} |`;
  const [head, ...body] = table.rows;
  return [line(head), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function entryTitle(entry: Pick<NotebookEntry, 'title' | 'entryType' | 'classNumber'>, t: Translate): string {
  const title = entry.title.trim() || t('notebook.untitled');
  return entry.entryType === 'CLASS' && entry.classNumber != null
    ? `${t('notebook.classLabel', { n: entry.classNumber })}: ${title}`
    : title;
}

export function entryToMarkdown(entry: NotebookEntry, areaName: string, t: Translate, level = 1): string {
  const parts: string[] = [
    heading(level, entryTitle(entry, t)),
    `_${[areaName, t(TYPE_LABEL_KEY[entry.entryType]), entry.date.slice(0, 10)].join(' · ')}_`,
  ];

  const text = entry.textContent?.trim();
  if (text) parts.push(text);

  for (const table of entry.tables ?? []) {
    const markdown = tableToMarkdown(table);
    if (markdown) parts.push(markdown);
  }

  const links = (entry.usefulLinks ?? []).filter((link) => link.url.trim());
  if (links.length > 0) {
    parts.push(heading(level + 1, t('notebook.md.links')));
    parts.push(
      links
        .map((link) => `- [${(link.label.trim() || link.url).replace(/[[\]]/g, '\\$&')}](<${link.url.trim()}>)`)
        .join('\n'),
    );
  }

  const boardTexts = (entry.canvasTexts ?? []).map((item) => item.text.trim()).filter(Boolean);
  const hasDrawing = (entry.drawingStrokes?.length ?? 0) > 0 || (entry.canvasShapes?.length ?? 0) > 0;
  if (boardTexts.length > 0 || hasDrawing) {
    parts.push(heading(level + 1, t('notebook.md.whiteboard')));
    if (boardTexts.length > 0) parts.push(boardTexts.map((value) => `- ${value.replace(/\r?\n/g, ' ')}`).join('\n'));
    if (hasDrawing) parts.push(`_${t('notebook.md.drawingNotIncluded')}_`);
  }

  if (entry.attachments.length > 0 || entry.photos.length > 0) {
    parts.push(heading(level + 1, t('notebook.md.files')));
    const lines = entry.attachments.map((file) => `- ${file.originalFileName} (${formatSize(file.sizeBytes)})`);
    if (entry.photos.length > 0) lines.push(`- ${t('notebook.md.photos', { count: entry.photos.length })}`);
    parts.push(lines.join('\n'));
    parts.push(`_${t('notebook.md.filesNotIncluded')}_`);
  }

  return `${parts.join('\n\n')}\n`;
}

// A cadeira inteira num so ficheiro, pela ordem das aulas (mais antiga
// primeiro), como um caderno se le.
export function courseToMarkdown(areaName: string, entries: NotebookEntry[], t: Translate): string {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const body = ordered.map((entry) => entryToMarkdown(entry, areaName, t, 2).trimEnd()).join('\n\n---\n\n');
  return `${heading(1, areaName)}\n\n${body}\n`;
}

// "Redes de Computadores", "Aula 3" -> "redes-de-computadores-aula-3.md"
export function markdownFileName(...parts: string[]): string {
  const slug = foldText(parts.join(' '))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return `${slug || 'notebook'}.md`;
}
