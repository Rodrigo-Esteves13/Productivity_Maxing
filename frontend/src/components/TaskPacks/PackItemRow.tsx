import { useState, type FormEvent } from 'react';
import type { TaskPackItem, TaskPackItemEdit } from '../../api/taskPackService';
import { draftFromItem, packItemChanges } from '../../lib/packItemEdit';
import { useI18n } from '../../i18n/useI18n';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import InlineConfirm from '../UI/InlineConfirm';

// Igual ao limite do backend (MAX_PACK_ITEM_TITLE_LENGTH).
const MAX_TITLE_LENGTH = 200;

type Mode = 'view' | 'edit' | 'confirm';

interface Props {
  item: TaskPackItem;
  canRemove: boolean;
  isBusy: boolean;
  onUpdate: (itemId: string, edit: TaskPackItemEdit) => Promise<string | null>;
  onRemove: (itemId: string) => Promise<string | null>;
}

export default function PackItemRow({ item, canRemove, isBusy, onUpdate, onRemove }: Props) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(() => draftFromItem(item));
  const [error, setError] = useState('');

  const close = () => {
    setMode('view');
    setError('');
  };

  const open = () => {
    setDraft(draftFromItem(item));
    setError('');
    setMode('edit');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return setError(t('f7Study.packs.needTitle'));
    const edit = packItemChanges(item, draft);
    if (Object.keys(edit).length === 0) return close();
    const failure = await onUpdate(item.id, edit);
    if (failure === null) close();
    else setError(failure);
  };

  const remove = async () => {
    const failure = await onRemove(item.id);
    if (failure !== null) {
      setError(failure);
      setMode('view');
    }
  };

  if (mode === 'edit') {
    return (
      <li className="rounded-lg border border-neutral-700 p-3">
        <form onSubmit={(e) => void save(e)} className="space-y-3">
          <Input
            label={t('f7Study.packs.title')}
            value={draft.title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('f7Study.packs.date')}
              type="date"
              required
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            />
            <Input
              label={t('f7Study.packs.weight')}
              type="number"
              min={0}
              max={100}
              step="any"
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
            />
          </div>
          <p className="text-xs text-neutral-500">
            {t(item.sourceTaskId ? 'f7Study.packs.editsSource' : 'f7Study.packs.editsPackOnly')}
          </p>
          {error && <FormError message={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isBusy ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-neutral-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-neutral-100" title={item.title}>
            {item.title}
          </p>
          <p className="text-xs text-neutral-500">
            {item.areaName} · {new Date(item.date).toLocaleDateString(lang)}
            {item.weightPercentage !== null && ` · ${item.weightPercentage}%`}
          </p>
        </div>
        {mode === 'view' && (
          <div className="flex gap-3">
            <button type="button" onClick={open} className="text-sm text-neutral-300 hover:text-white pointer-coarse:min-h-11 pointer-coarse:px-2">
              {t('f7Study.packs.edit')}
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => setMode('confirm')}
                className="text-sm text-neutral-400 hover:text-red-400 pointer-coarse:min-h-11 pointer-coarse:px-2"
              >
                {t('f7Study.packs.remove')}
              </button>
            )}
          </div>
        )}
      </div>
      {mode === 'confirm' && (
        <InlineConfirm
          className="mt-2"
          message={t('f7Study.packs.removeConfirm')}
          confirmLabel={t('f7Study.packs.remove')}
          isBusy={isBusy}
          onConfirm={() => void remove()}
          onCancel={close}
        />
      )}
      {error && <FormError message={error} />}
    </li>
  );
}
