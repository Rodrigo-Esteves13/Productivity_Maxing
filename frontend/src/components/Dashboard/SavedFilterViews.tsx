import { useState } from 'react';
import { useSavedFilterViews } from '../../hooks/useSavedFilterViews';
import type { DashboardFiltersState } from './dashboardFilters.types';
import { XIcon } from '../UI/Icons';
import Input from '../UI/Input';
import Button from '../UI/Button';

interface SavedFilterViewsProps {
  filters: DashboardFiltersState;
  hasActiveFilters: boolean;
  onApply: (filters: DashboardFiltersState) => void;
}

// Lets a set of dashboard filters be saved under a name and re-applied
// later with one click, instead of rebuilding the same combination of
// Area/Type/Difficulty/Status every time. Saved views live only in this
// browser (see useSavedFilterViews), same tier as the widget visibility
// preferences.
export default function SavedFilterViews({ filters, hasActiveFilters, onApply }: SavedFilterViewsProps) {
  const { views, saveView, deleteView } = useSavedFilterViews();
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveView(trimmed, filters);
    setName('');
    setIsNaming(false);
  };

  if (views.length === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-800">
      <span className="text-xs uppercase tracking-wide text-neutral-500 mr-1">Views:</span>

      {views.map((view) => (
        <span
          key={view.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800/60 pl-3 pr-1.5 py-1 text-xs text-neutral-200"
        >
          <button type="button" onClick={() => onApply(view.filters)} className="hover:text-white">
            {view.name}
          </button>
          <button
            type="button"
            onClick={() => deleteView(view.id)}
            aria-label={`Delete saved view ${view.name}`}
            className="text-neutral-500 hover:text-red-400"
          >
            <XIcon width={12} height={12} />
          </button>
        </span>
      ))}

      {isNaming ? (
        <span className="inline-flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setIsNaming(false);
                setName('');
              }
            }}
            placeholder="View name"
            className="w-32 py-1"
          />
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </span>
      ) : (
        hasActiveFilters && (
          <button
            type="button"
            onClick={() => setIsNaming(true)}
            className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-dotted"
          >
            + Save current filters as view
          </button>
        )
      )}
    </div>
  );
}
