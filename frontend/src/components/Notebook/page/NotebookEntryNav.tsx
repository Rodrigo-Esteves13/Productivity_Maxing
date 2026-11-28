import { useI18n } from '../../../i18n/useI18n';
import { ChevronLeftIcon, ChevronRightIcon } from '../../UI/Icons';
import type { NotebookEntrySummary } from '../../../types/models';

interface NotebookEntryNavProps {
  selectedIndex: number;
  total: number;
  olderEntry: NotebookEntrySummary | null;
  newerEntry: NotebookEntrySummary | null;
  onSelect: (entry: NotebookEntrySummary | null) => void;
  onPrefetch: (id: string) => void;
}

// Voltar ao resumo e saltar para a nota anterior/seguinte.
export default function NotebookEntryNav({
  selectedIndex,
  total,
  olderEntry,
  newerEntry,
  onSelect,
  onPrefetch,
}: NotebookEntryNavProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('notebook.nav.label')} className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="rounded-md px-2 py-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white pointer-coarse:min-h-11"
      >
        {t('notebook.nav.overview')}
      </button>
      <div className="flex items-center gap-1">
        <span className="px-1 tabular-nums text-neutral-500">
          {t('notebook.nav.position', { index: selectedIndex + 1, total })}
        </span>
        <button
          type="button"
          disabled={!olderEntry}
          onClick={() => olderEntry && onSelect(olderEntry)}
          onPointerEnter={() => olderEntry && onPrefetch(olderEntry.id)}
          title={olderEntry?.title}
          className="flex items-center gap-0.5 rounded-md px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent pointer-coarse:min-h-11"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {t('notebook.nav.older')}
        </button>
        <button
          type="button"
          disabled={!newerEntry}
          onClick={() => newerEntry && onSelect(newerEntry)}
          onPointerEnter={() => newerEntry && onPrefetch(newerEntry.id)}
          title={newerEntry?.title}
          className="flex items-center gap-0.5 rounded-md px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent pointer-coarse:min-h-11"
        >
          {t('notebook.nav.newer')}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
