import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Button from '../UI/Button';
import Input from '../UI/Input';
import { CheckIcon, XIcon, PencilIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';
import { editSharedEntry } from '../../api/notebookService';
import CaseTransformBar from './CaseTransformBar';
import EntrySectionHeader from './entry/EntrySectionHeader';
import NotesCounter from './entry/NotesCounter';
import { MAX_TEXT_CONTENT_LENGTH } from './entry/notebookEntryConfig';

const MAX_TITLE_LENGTH = 200;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <input
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('notebook.titlePlaceholder')}
        aria-label={t('sharedEdit.title')}
        className="min-w-0 w-full border-b border-transparent bg-transparent pb-1 font-serif text-2xl font-semibold leading-tight text-white placeholder-neutral-700 transition-colors focus:border-violet-500 focus:outline-none sm:text-3xl"
      />

      <section>
        <EntrySectionHeader icon={PencilIcon} title={t('sharedEdit.notes')} />
        <div className="mb-3">
          <CaseTransformBar textareaRef={textareaRef} textContent={text} onTextChange={setText} />
        </div>
        <textarea
          id="shared-edit-notes"
          ref={textareaRef}
          value={text}
          maxLength={MAX_TEXT_CONTENT_LENGTH}
          rows={10}
          onChange={(e) => setText(e.target.value)}
          className="notebook-ruled w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 font-serif text-base text-neutral-100 placeholder-neutral-700 focus:border-violet-500 focus:outline-none"
        />
        <NotesCounter text={text} />
      </section>

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
