import { useState } from 'react';
import type { FormEvent } from 'react';
import type { GradeComponent, GradeComponentInput } from '../../types/models';
import { PencilIcon, PlusIcon, TrashIcon } from '../UI/Icons';
import IconButton from '../UI/IconButton';
import Button from '../UI/Button';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';
import type { GradeEntryInput } from '../../api/gradeComponentsService';
import GradeComponentForm from './GradeComponentForm';
import GradeEntryChip from './GradeEntryChip';

interface GradeComponentCardProps {
  component: GradeComponent;
  onUpdate: (changes: Partial<GradeComponentInput>) => Promise<void>;
  onRequestDelete: () => void;
  onAddEntry: (input: GradeEntryInput) => Promise<void>;
  onEditEntry: (entryId: string, grade: number) => Promise<void>;
  onRemoveEntry: (entryId: string) => Promise<void>;
}

export default function GradeComponentCard({
  component,
  onUpdate,
  onRequestDelete,
  onAddEntry,
  onEditEntry,
  onRemoveEntry,
}: GradeComponentCardProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [gradeDraft, setGradeDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (isEditing) {
    return (
      <GradeComponentForm
        initial={component}
        onSubmit={async (input) => {
          await onUpdate(input);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const count = component.entries.length;
  const ruleLabel =
    component.aggregation === 'BEST_OF'
      ? t('grades.rule.bestOfN', { n: component.bestOfCount ?? count })
      : t(component.aggregation === 'DROP_LOWEST' ? 'grades.rule.dropLowest' : 'grades.rule.average');
  const progress = component.expectedEntries
    ? Math.min(100, Math.round((count / component.expectedEntries) * 100))
    : null;

  const guard = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getApiMessage(err, t('grades.error.generic')));
    }
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(gradeDraft);
    if (gradeDraft.trim() === '' || !Number.isFinite(value)) return;
    setIsAdding(true);
    await guard(async () => {
      await onAddEntry({ grade: value, label: labelDraft.trim() || undefined });
      setGradeDraft('');
      setLabelDraft('');
    });
    setIsAdding(false);
  };

  return (
    <li className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{component.name}</p>
          <p className="text-xs text-neutral-500">
            {t('grades.weightValue', { weight: component.weightPercentage })} · {ruleLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="mr-2 text-right">
            {component.grade !== null ? (
              <span className="text-xl font-semibold tabular-nums text-white">{component.grade}</span>
            ) : (
              <span className="text-xs text-neutral-500">{t('grades.noGrade')}</span>
            )}
          </div>
          <IconButton label={t('grades.edit')} className="hover:bg-neutral-800" onClick={() => setIsEditing(true)}>
            <PencilIcon className="h-4 w-4" />
          </IconButton>
          <IconButton label={t('grades.delete')} tone="danger" className="hover:bg-neutral-800" onClick={onRequestDelete}>
            <TrashIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-neutral-500">
            {t('grades.progress', { count, total: component.expectedEntries ?? count })}
          </p>
        </div>
      )}

      {count > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {component.entries.map((entry) => (
            <GradeEntryChip
              key={entry.id}
              entry={entry}
              onChange={(grade) => guard(() => onEditEntry(entry.id, grade))}
              onRemove={() => guard(() => onRemoveEntry(entry.id))}
            />
          ))}
        </div>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          step="any"
          value={gradeDraft}
          onChange={(e) => setGradeDraft(e.target.value)}
          placeholder={t('grades.entry.grade')}
          aria-label={t('grades.entry.grade')}
          className="w-20 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm tabular-nums text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        <input
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          placeholder={t('grades.entry.label')}
          aria-label={t('grades.entry.label')}
          maxLength={80}
          className="min-w-[8rem] flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={isAdding || gradeDraft.trim() === ''}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t('grades.entry.add')}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
