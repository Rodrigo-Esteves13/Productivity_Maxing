import type { NotebookSearchResult } from '../../types/models';
import { PencilIcon, BookOpenIcon, GraduationCapIcon } from '../UI/Icons';

interface NotebookSearchResultsProps {
  results: NotebookSearchResult[];
  isLoading: boolean;
  query: string;
  onSelect: (result: NotebookSearchResult) => void;
}

const TYPE_ICON = {
  NOTE: PencilIcon,
  STUDY: BookOpenIcon,
  CLASS: GraduationCapIcon,
} as const;

export default function NotebookSearchResults({
  results,
  isLoading,
  query,
  onSelect,
}: NotebookSearchResultsProps) {
  if (isLoading) {
    return <p className="text-sm text-neutral-500">Searching...</p>;
  }

  if (results.length === 0) {
    return <p className="text-sm text-neutral-500">No entries match "{query}".</p>;
  }

  return (
    <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
      {results.map((result) => {
        const Icon = TYPE_ICON[result.entryType];
        return (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => onSelect(result)}
              className="flex w-full items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-left transition-colors hover:border-neutral-700"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: result.area.colorHex }}
              />
              <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-100">
                  {result.entryType === 'CLASS' && result.classNumber != null && (
                    <span className="mr-1 text-violet-400">#{result.classNumber}</span>
                  )}
                  {result.title || 'Untitled entry'}
                </p>
                <p className="truncate text-xs text-neutral-500">{result.area.name}</p>
              </div>
              <span className="shrink-0 text-xs text-neutral-500">
                {new Date(result.date).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
