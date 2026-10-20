import { useMemo } from 'react';
import { countWords } from '../../../lib/wordCount';
import { useI18n } from '../../../i18n/useI18n';
import { MAX_TEXT_CONTENT_LENGTH } from './notebookEntryConfig';

interface NotesCounterProps {
  text: string;
  max?: number;
}

// Palavras e caracteres/limite por baixo de uma caixa de notas. Partilhado
// pelo editor do dono e pelo editor de quem recebeu a nota partilhada.
export default function NotesCounter({ text, max = MAX_TEXT_CONTENT_LENGTH }: NotesCounterProps) {
  const { t } = useI18n();
  const wordCount = useMemo(() => countWords(text), [text]);
  const isOverLimit = text.length > max;

  return (
    <p className="mt-1 flex justify-end gap-3 text-[11px] tabular-nums text-neutral-600">
      <span>{t('notebook.notes.words', { count: wordCount.toLocaleString() })}</span>
      <span className={isOverLimit ? 'text-red-400' : undefined}>
        {t('notebook.notes.chars', {
          count: text.length.toLocaleString(),
          max: max.toLocaleString(),
        })}
      </span>
    </p>
  );
}
