import type { NotebookEntry } from '../../types/models';
import { PencilIcon } from '../UI/Icons';

interface NotebookEntryListProps {
  entries: NotebookEntry[];
  selectedId: string | null;
  onSelect: (entry: NotebookEntry) => void;
}

export default function NotebookEntryList({ entries, selectedId, onSelect }: NotebookEntryListProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500">
        No entries yet for this subject. Start a new one above.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const isSelected = entry.id === selectedId;
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'bg-violet-600/20 text-violet-200'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{entry.title || 'Untitled entry'}</span>
              <span className="shrink-0 text-xs text-neutral-500">
                {new Date(entry.date).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
