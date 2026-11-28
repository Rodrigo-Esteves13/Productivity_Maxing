import type { Ref } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { SearchIcon, XIcon } from '../../UI/Icons';

interface NotebookSearchBarProps {
  inputRef: Ref<HTMLInputElement>;
  query: string;
  isActive: boolean;
  onChange: (query: string) => void;
}

export default function NotebookSearchBar({ inputRef, query, isActive, onChange }: NotebookSearchBarProps) {
  const { t } = useI18n();
  return (
    <div className="relative mb-6">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('notebook.search.placeholder')}
        aria-label={t('notebook.search.placeholder')}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 pl-10 pr-9 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
      />
      {!isActive && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:block"
        >
          /
        </kbd>
      )}
      {isActive && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          aria-label={t('notebook.search.clear')}
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
