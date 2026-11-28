import type { EntryShareBadge } from '../components/Notebook/NotebookEntryList';
import type { Area, NotebookEntrySummary } from '../types/models';

// Título nunca pode ficar vazio (o backend exige @IsNotEmpty) - sem aula
// detetada, usa a data por extenso em vez de deixar em branco.
export function buildFallbackTitle(locale: string, date: Date = new Date()): string {
  const label = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Maior classNumber já usado nesta Area (entre entradas CLASS) + 1 - só
// uma sugestão, nunca bloqueia o utilizador de repetir ou saltar um
// número (ver pedido original: uma aula física pode dar para duas
// cadeiras e ele quer duas entradas separadas, cada uma como se fosse
// "mudar de página").
export function nextClassNumber(entries: Pick<NotebookEntrySummary, 'entryType' | 'classNumber'>[]): number {
  const usedNumbers = entries
    .filter((e) => e.entryType === 'CLASS' && e.classNumber != null)
    .map((e) => e.classNumber as number);
  return usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
}

// A cadeira a abrir quando nenhuma esta escolhida: as do periodo primeiro.
export function fallbackArea(areas: Area[]): Area | null {
  return areas.find((a) => a.usedInPeriod) ?? areas[0] ?? null;
}

// Anterior/seguinte na ordem da lista (mais recente primeiro): "anterior"
// e a entrada mais antiga a seguir, "seguinte" a mais recente.
export function adjacentEntries<T extends { id: string }>(
  entries: T[],
  selectedId: string | null,
): { selectedIndex: number; olderEntry: T | null; newerEntry: T | null } {
  const selectedIndex = selectedId ? entries.findIndex((e) => e.id === selectedId) : -1;
  return {
    selectedIndex,
    olderEntry: selectedIndex >= 0 ? (entries[selectedIndex + 1] ?? null) : null,
    newerEntry: selectedIndex > 0 ? entries[selectedIndex - 1] : null,
  };
}

// Estado de partilha de cada nota (icone e pendentes na lista).
export function shareBadges(
  items: { entryId: string; pendingRequests: number; pendingProposals: number }[],
): Map<string, EntryShareBadge> {
  return new Map(
    items.map((share) => [share.entryId, { waiting: share.pendingRequests + share.pendingProposals }]),
  );
}
