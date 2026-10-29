import { useState } from 'react';
import type { GradeEntry } from '../../types/models';
import { XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface GradeEntryChipProps {
  entry: GradeEntry;
  onChange: (grade: number) => Promise<void>;
  onRemove: () => Promise<void>;
}

// Uma nota dentro de um componente. Clicar edita o valor ali mesmo
// (Enter grava, Esc cancela); o x remove.
export default function GradeEntryChip({ entry, onChange, onRemove }: GradeEntryChipProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(entry.grade));

  const commit = async () => {
    const value = Number(draft);
    setIsEditing(false);
    if (draft.trim() === '' || !Number.isFinite(value) || value === entry.grade) return;
    await onChange(value);
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        step="any"
        value={draft}
        aria-label={entry.label ?? t('grades.entry.grade')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') setIsEditing(false);
        }}
        className="w-16 rounded-md border border-violet-500 bg-neutral-900 px-2 py-1 text-sm tabular-nums text-white focus:outline-none"
      />
    );
  }

  return (
    <span className="group inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 text-sm text-neutral-200">
      <button
        type="button"
        title={entry.label ?? undefined}
        onClick={() => {
          setDraft(String(entry.grade));
          setIsEditing(true);
        }}
        className="px-2 py-1 tabular-nums hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        {entry.grade}
      </button>
      <button
        type="button"
        aria-label={t('grades.entry.remove')}
        title={t('grades.entry.remove')}
        onClick={() => void onRemove()}
        className="px-1.5 py-1 text-neutral-500 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
