import { useState } from 'react';
import type { GradeEntry } from '../../types/models';
import type { GradeEntryInput } from '../../api/gradeComponentsService';
import { XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface GradeEntryChipProps {
  entry: GradeEntry;
  onChange: (changes: Partial<GradeEntryInput>) => Promise<void>;
  onRemove: () => Promise<void>;
}

const MAX_LABEL_LENGTH = 80;
const FIELD_CLASS =
  'rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none';

// Uma nota dentro de um componente. Clicar edita valor, rotulo e data ali mesmo
// (Enter grava, Esc cancela); o x remove.
export default function GradeEntryChip({ entry, onChange, onRemove }: GradeEntryChipProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(entry.grade));
  const [labelDraft, setLabelDraft] = useState(entry.label ?? '');
  const [dateDraft, setDateDraft] = useState(entry.date ? entry.date.slice(0, 10) : '');

  const open = () => {
    setDraft(String(entry.grade));
    setLabelDraft(entry.label ?? '');
    setDateDraft(entry.date ? entry.date.slice(0, 10) : '');
    setIsEditing(true);
  };

  const commit = async () => {
    const value = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(value)) return;
    const changes: Partial<GradeEntryInput> = {};
    if (value !== entry.grade) changes.grade = value;
    const label = labelDraft.trim();
    if (label !== (entry.label ?? '')) changes.label = label;
    // A API nao limpa datas: so envia quando ha uma data nova.
    if (dateDraft && dateDraft !== (entry.date ?? '').slice(0, 10)) changes.date = dateDraft;
    setIsEditing(false);
    if (Object.keys(changes).length === 0) return;
    await onChange(changes);
  };

  if (isEditing) {
    return (
      <form
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-violet-500/60 bg-neutral-900/60 p-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setIsEditing(false);
          }
        }}
      >
        <input
          autoFocus
          type="number"
          step="any"
          value={draft}
          aria-label={t('grades.entry.grade')}
          onChange={(e) => setDraft(e.target.value)}
          className={`w-20 tabular-nums ${FIELD_CLASS}`}
        />
        <input
          value={labelDraft}
          maxLength={MAX_LABEL_LENGTH}
          placeholder={t('grades.entry.label')}
          aria-label={t('grades.entry.label')}
          onChange={(e) => setLabelDraft(e.target.value)}
          className={`min-w-[7rem] flex-1 ${FIELD_CLASS}`}
        />
        <input
          type="date"
          value={dateDraft}
          aria-label={t('quickWins.gradeEntryDate')}
          onChange={(e) => setDateDraft(e.target.value)}
          className={FIELD_CLASS}
        />
        <button
          type="submit"
          className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          {t('common.cancel')}
        </button>
      </form>
    );
  }

  return (
    <span className="group inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900 text-sm text-neutral-200">
      <button
        type="button"
        title={t('quickWins.gradeEntryEdit')}
        aria-label={t('quickWins.gradeEntryEditNamed', { grade: entry.grade, label: entry.label ?? '' })}
        onClick={open}
        className="flex min-h-9 items-center gap-1.5 px-2 py-1 pointer-coarse:min-h-11 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <span className="tabular-nums">{entry.grade}</span>
        {entry.label && <span className="max-w-[10rem] truncate text-xs text-neutral-400">{entry.label}</span>}
      </button>
      <button
        type="button"
        aria-label={t('grades.entry.remove')}
        title={t('grades.entry.remove')}
        onClick={() => void onRemove()}
        className="flex min-h-9 min-w-9 items-center justify-center px-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 py-1 text-neutral-500 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
