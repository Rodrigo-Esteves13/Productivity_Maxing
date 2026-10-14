import { useI18n } from '../../../i18n/useI18n';

interface EntryTitleProps {
  title: string;
  isEditing: boolean;
  onTitleChange: (title: string) => void;
}

// Titulo da entrada em serifa grande - e o "cabecalho" da folha. Em edicao
// e o mesmo texto, so com um traco por baixo ao focar.
export default function EntryTitle({ title, isEditing, onTitleChange }: EntryTitleProps) {
  const { t } = useI18n();
  const base = 'min-w-0 w-full font-serif text-2xl font-semibold leading-tight text-white sm:text-3xl';

  if (isEditing) {
    return (
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t('notebook.titlePlaceholder')}
        aria-label={t('notebook.titlePlaceholder')}
        className={`${base} border-b border-transparent bg-transparent pb-1 placeholder-neutral-700 transition-colors focus:border-violet-500 focus:outline-none`}
      />
    );
  }
  return <h2 className={`${base} break-words`}>{title || t('notebook.untitled')}</h2>;
}
