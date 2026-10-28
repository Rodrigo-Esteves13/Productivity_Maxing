import { useState, type FormEvent } from 'react';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Textarea from '../UI/Textarea';
import { useI18n } from '../../i18n/useI18n';
import type { PersonalNoteInput } from '../../api/personalNotesService';
import type { PersonalNote } from '../../types/models';

export const PERSONAL_NOTE_TITLE_MAX_LENGTH = 200;
export const PERSONAL_NOTE_BODY_MAX_LENGTH = 10_000;

// <input type="datetime-local"> quer "YYYY-MM-DDTHH:mm" na hora local.
const LOCAL_INPUT_LENGTH = 16;
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, LOCAL_INPUT_LENGTH);
}

interface PersonalNoteFormProps {
  initial?: PersonalNote;
  onSubmit: (input: PersonalNoteInput & { title: string }) => Promise<boolean>;
  onCancel?: () => void;
}

// Criar ou editar uma nota pessoal, com lembrete opcional.
export default function PersonalNoteForm({ initial, onSubmit, onCancel }: PersonalNoteFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [remindAt, setRemindAt] = useState(toLocalInput(initial?.remindAt ?? null));
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    const ok = await onSubmit({
      title: title.trim(),
      body,
      remindAt: remindAt ? new Date(remindAt).toISOString() : null,
    });
    setIsSaving(false);
    if (ok && !initial) {
      setTitle('');
      setBody('');
      setRemindAt('');
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <Input
        required
        value={title}
        maxLength={PERSONAL_NOTE_TITLE_MAX_LENGTH}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('notes.titlePlaceholder')}
        aria-label={t('notes.titleLabel')}
      />
      <Textarea
        rows={3}
        value={body}
        maxLength={PERSONAL_NOTE_BODY_MAX_LENGTH}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('notes.bodyPlaceholder')}
        aria-label={t('notes.bodyLabel')}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-400">
          {t('notes.remindAt')}
          <Input
            type="datetime-local"
            className="mt-1"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </label>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              {t('ui.cancel')}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSaving || !title.trim()}>
            {initial ? t('notes.save') : t('notes.add')}
          </Button>
        </div>
      </div>
    </form>
  );
}
