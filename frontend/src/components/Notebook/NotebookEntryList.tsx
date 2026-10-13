import { useMemo, useState } from 'react';
import type { NotebookEntry, NotebookEntryType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { PencilIcon, BookOpenIcon, GraduationCapIcon, SearchIcon } from '../UI/Icons';
import SegmentedControl, { type SegmentedOption } from '../UI/SegmentedControl';
import SectionLabel from '../UI/SectionLabel';
import EmptyState from '../UI/EmptyState';

interface NotebookEntryListProps {
  entries: NotebookEntry[];
  selectedId: string | null;
  onSelect: (entry: NotebookEntry) => void;
}

type TypeFilter = 'ALL' | NotebookEntryType;

const TYPE_ICON = {
  NOTE: PencilIcon,
  STUDY: BookOpenIcon,
  CLASS: GraduationCapIcon,
} as const;

// Só mostra filtros/pesquisa a partir de alguns itens - com 3 entradas
// seria ruído.
const FILTER_MIN_ENTRIES = 6;

export default function NotebookEntryList({ entries, selectedId, onSelect }: NotebookEntryListProps) {
  const { t, lang } = useI18n();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [query, setQuery] = useState('');

  const filterOptions: SegmentedOption<TypeFilter>[] = [
    { value: 'ALL', label: t('notebook.filter.all') },
    { value: 'NOTE', label: t('notebook.type.note') },
    { value: 'STUDY', label: t('notebook.type.study') },
    { value: 'CLASS', label: t('notebook.type.class') },
  ];

  // Mantém a ordem vinda da API e agrupa por mês (secções contíguas).
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = entries.filter(
      (e) =>
        (typeFilter === 'ALL' || e.entryType === typeFilter) &&
        (!normalized || (e.title ?? '').toLowerCase().includes(normalized)),
    );
    const result: { key: string; label: string; items: NotebookEntry[] }[] = [];
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

      {groups.length === 0 ? (
        <EmptyState message={t('notebook.list.noMatch')} />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-1">
            <SectionLabel>{group.label}</SectionLabel>
            <ul className="space-y-1">
              {group.items.map((entry) => {
                const isSelected = entry.id === selectedId;
                const Icon = TYPE_ICON[entry.entryType];
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? 'bg-violet-600/20 text-violet-200' : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="flex-1 truncate">
                        {entry.entryType === 'CLASS' && entry.classNumber != null && (
                          <span className="mr-1 text-violet-400">#{entry.classNumber}</span>
                        )}
                        {entry.title || t('notebook.untitled')}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {new Date(entry.date).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
