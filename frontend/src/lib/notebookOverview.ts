import type { NotebookEntry, NotebookEntrySummary, NotebookEntryType } from '../types/models';

const MS_PER_DAY = 86_400_000;
// Acima disto o "numero da aula" ja nao parece uma sequencia real (ex.: 2026).
const MAX_CLASS_SEQUENCE = 60;

/**
 * Primeira parte do texto de uma entrada, sem marcas de Markdown/tabela,
 * para a lista e o resumo. Vazio quando nao ha texto.
 */
export function entryPreview(text: string | null | undefined, max = 120): string {
  if (!text) return '';
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]+/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

/**
 * Aulas em falta na sequencia 1..maior numero usado (ex.: tens #1, #2, #4 ->
 * falta a #3). So entradas de aula com numero contam.
 */
export function missingClassNumbers(entries: Pick<NotebookEntry, 'entryType' | 'classNumber'>[]): number[] {
  const used = new Set(
    entries
      .filter((e) => e.entryType === 'CLASS' && e.classNumber != null && e.classNumber > 0)
      .map((e) => e.classNumber as number),
  );
  if (used.size === 0) return [];
  const highest = Math.max(...used);
  if (highest > MAX_CLASS_SEQUENCE) return [];
  const missing: number[] = [];
  for (let n = 1; n < highest; n++) if (!used.has(n)) missing.push(n);
  return missing;
}

export function countByType(entries: Pick<NotebookEntry, 'entryType'>[]): Record<NotebookEntryType, number> {
  const counts: Record<NotebookEntryType, number> = { CLASS: 0, NOTE: 0, STUDY: 0 };
  for (const e of entries) counts[e.entryType] += 1;
  return counts;
}

/** "hoje", "ontem", "ha 5 dias" na lingua da app (por dias de calendario). */
export function relativeDay(iso: string, locale: string, now = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / MS_PER_DAY);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
}

// Igual ao backend (listSummariesForArea): o resumo leva o inicio do texto.
const SUMMARY_PREVIEW_CHARS = 400;

/** A linha da lista a partir de uma entrada completa (depois de criar/gravar). */
export function toEntrySummary(entry: NotebookEntry): NotebookEntrySummary {
  return {
    id: entry.id,
    areaId: entry.areaId,
    title: entry.title,
    entryType: entry.entryType,
    classNumber: entry.classNumber,
    date: entry.date,
    preview: entry.textContent ? entry.textContent.slice(0, SUMMARY_PREVIEW_CHARS) : null,
    photoCount: entry.photos?.length ?? 0,
    attachmentCount: entry.attachments?.length ?? 0,
  };
}
