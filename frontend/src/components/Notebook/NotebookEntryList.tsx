import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { NotebookEntrySummary, NotebookEntryType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { FileIcon, ImageIcon, LinkIcon, SearchIcon } from '../UI/Icons';
import { entryPreview } from '../../lib/notebookOverview';
import { ENTRY_TYPE_ICON, useEntryTypeOptions } from '../../hooks/useEntryTypeOptions';
import SegmentedControl, { type SegmentedOption } from '../UI/SegmentedControl';
import EmptyState from '../UI/EmptyState';

/** Estado de partilha de uma nota (de "As minhas partilhas"). */
export interface EntryShareBadge {
  // Pedidos de acesso + sugestoes de editores a espera de decisao.
  waiting: number;
}

interface NotebookEntryListProps {
  entries: NotebookEntrySummary[];
  selectedId: string | null;
  onSelect: (entry: NotebookEntrySummary) => void;
  // Passar o rato por cima ja pede a entrada: o clique abre-a sem esperar.
  onPrefetch?: (id: string) => void;
  shareByEntry?: Map<string, EntryShareBadge>;
}

type TypeFilter = 'ALL' | NotebookEntryType;

// Só mostra filtros/pesquisa a partir de alguns itens - com 3 entradas
// seria ruído.
const FILTER_MIN_ENTRIES = 6;

export default function NotebookEntryList({ entries, selectedId, onSelect, onPrefetch, shareByEntry }: NotebookEntryListProps) {
  const { t, lang } = useI18n();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [query, setQuery] = useState('');

  const typeOptions = useEntryTypeOptions();
  const filterOptions: SegmentedOption<TypeFilter>[] = [
    { value: 'ALL', label: t('notebook.filter.all') },
    ...typeOptions,
  ];

  // Mantém a ordem vinda da API e agrupa por mês (secções contíguas).
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = entries.filter(
      (e) =>
        (typeFilter === 'ALL' || e.entryType === typeFilter) &&
        (!normalized || (e.title ?? '').toLowerCase().includes(normalized)),
    );
    const result: { key: string; label: string; items: NotebookEntrySummary[] }[] = [];
    for (const entry of visible) {
      const key = entry.date.slice(0, 7);
      const last = result[result.length - 1];
      if (last && last.key === key) {
        last.items.push(entry);
      } else {
        const label = new Date(entry.date).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
        result.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [entry] });
      }
    }
    return result;
  }, [entries, typeFilter, query, lang]);

  // Setas cima/baixo (e Home/End) andam pela lista visivel e abrem a nota,
  // como num explorador de ficheiros.
  const listRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-entry-id]') ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1 || buttons.length === 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : Math.min(buttons.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
    if (next === current) return;
    buttons[next].focus();
    buttons[next].click();
  };

  if (entries.length === 0) {
    return <EmptyState message={t('notebook.list.empty')} />;
  }

  const showFilters = entries.length >= FILTER_MIN_ENTRIES;

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="space-y-2">
          <SegmentedControl size="sm" options={filterOptions} value={typeFilter} onChange={setTypeFilter} />
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('notebook.filter.search')}
              aria-label={t('notebook.filter.search')}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-2 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <p id="notebook-list-keys" className="sr-only">
        {t('notebook.list.keysHint')}
      </p>
      {groups.length === 0 ? (
        <EmptyState message={t('notebook.list.noMatch')} />
      ) : (
        <div ref={listRef} onKeyDown={handleKeyDown} className="space-y-3">
        {groups.map((group) => (
          <section key={group.key} className="space-y-1">
            <h3 className="px-3 text-xs font-medium text-neutral-500">{group.label}</h3>
            <ul className="space-y-1">
              {group.items.map((entry) => {
                const isSelected = entry.id === selectedId;
                const Icon = ENTRY_TYPE_ICON[entry.entryType];
                const share = shareByEntry?.get(entry.id);
                const preview = entryPreview(entry.preview, 80);
                const photoCount = entry.photoCount;
                const fileCount = entry.attachmentCount;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      data-entry-id={entry.id}
                      onClick={() => onSelect(entry)}
                      onPointerEnter={isSelected ? undefined : () => onPrefetch?.(entry.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-describedby="notebook-list-keys"
                      className={`w-full rounded-md border-l-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
                        isSelected
                          ? 'border-violet-500 bg-violet-600/15 text-white'
                          : 'border-transparent text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="flex w-full items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="flex-1 truncate">
                        {entry.entryType === 'CLASS' && entry.classNumber != null && (
                          <span className="mr-1 text-violet-400">#{entry.classNumber}</span>
                        )}
                        {entry.title || t('notebook.untitled')}
                      </span>
                      {share && (
                        <span
                          title={share.waiting > 0 ? t('notebook.list.sharedWaiting', { count: share.waiting }) : t('notebook.list.shared')}
                          className="flex shrink-0 items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3 text-violet-400" aria-hidden="true" />
                          {share.waiting > 0 && (
                            <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-300">
                              {share.waiting}
                            </span>
                          )}
                          <span className="sr-only">
                            {share.waiting > 0 ? t('notebook.list.sharedWaiting', { count: share.waiting }) : t('notebook.list.shared')}
                          </span>
                        </span>
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                        {new Date(entry.date).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' })}
                      </span>
                      </span>
                      {(preview || photoCount > 0 || fileCount > 0) && (
                        <span className="mt-0.5 flex items-center gap-2 pl-5.5 text-xs text-neutral-500">
                          <span className="min-w-0 flex-1 truncate">{preview}</span>
                          {photoCount > 0 && (
                            <span className="flex shrink-0 items-center gap-0.5" title={t('notebook.list.photos', { count: photoCount })}>
                              <ImageIcon className="h-3 w-3" aria-hidden="true" />
                              {photoCount}
                              <span className="sr-only">{t('notebook.list.photos', { count: photoCount })}</span>
                            </span>
                          )}
                          {fileCount > 0 && (
                            <span className="flex shrink-0 items-center gap-0.5" title={t('notebook.list.files', { count: fileCount })}>
                              <FileIcon className="h-3 w-3" aria-hidden="true" />
                              {fileCount}
                              <span className="sr-only">{t('notebook.list.files', { count: fileCount })}</span>
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        </div>
      )}
    </div>
  );
}
