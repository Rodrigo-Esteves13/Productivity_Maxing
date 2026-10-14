import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from '../UI/Button';
import Input from '../UI/Input';
import { CheckIcon, XIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';
import { editSharedEntry } from '../../api/notebookService';

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 50000;
const MAX_NOTE_LENGTH = 300;

interface SharedEntryEditFormProps {
  token: string;
  // CO_OWNER grava direto; EDITOR envia uma sugestao para o dono aprovar.
  isProposal: boolean;
  initialTitle: string;
  initialText: string;
  // `applied` = true quando a alteracao ja foi aplicada (co-owner).
  onDone: (applied: boolean) => void;
  onCancel: () => void;
}

// Edicao de uma entrada partilhada: so titulo e notas (quadro branco,
// tabelas, fotos e anexos continuam so do dono).
export default function SharedEntryEditForm({
  token,
  isProposal,
  initialTitle,
  initialText,
  onDone,
  onCancel,
}: SharedEntryEditFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError(t('sharedEdit.titleRequired'));
    if (title === initialTitle && text === initialText) return setError(t('sharedEdit.noChanges'));

    setError('');
    setIsSaving(true);
    try {
      const result = await editSharedEntry(token, {
        title: title.trim(),
        textContent: text,
        note: isProposal ? note.trim() || undefined : undefined,
      });
      onDone(result.applied);
    } catch (err) {
      setError(getApiMessage(err, t('sharedEdit.error')));
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
    >
      <Input
        label={t('sharedEdit.title')}
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="space-y-1.5">
        <label htmlFor="shared-edit-notes" className="text-sm text-neutral-400">
          {t('sharedEdit.notes')}
        </label>
        <textarea
          id="shared-edit-notes"
          value={text}
          maxLength={MAX_TEXT_LENGTH}
          rows={10}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950/50 p-3 font-serif text-base leading-7 text-neutral-100 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {isProposal && (
        <Input
          label={t('sharedEdit.message')}
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-sm" onClick={onCancel}>
          <XIcon className="h-4 w-4" />
          {t('sharedEdit.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50">
          <CheckIcon className="h-4 w-4" />
          {isProposal ? t('sharedEdit.send') : t('sharedEdit.save')}
        </Button>
      </div>
    </form>
  );
}
