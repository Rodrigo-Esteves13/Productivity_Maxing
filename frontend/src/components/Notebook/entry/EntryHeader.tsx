import { PencilIcon, TrashIcon, XIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';

interface EntryHeaderProps {
  title: string;
  isEditing: boolean;
  onTitleChange: (title: string) => void;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
}

// Titulo + botoes de modo. So aparece "Edit" enquanto nao se ativa a
// edicao - de proposito, para nunca ser possivel mexer (nem apagar) numa
// entrada so de a estar a consultar.
export default function EntryHeader({
  title,
  isEditing,
  onTitleChange,
  onRequestEdit,
  onCancelEdit,
  onRequestDelete,
}: EntryHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3">
      {isEditing ? (
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t('notebook.titlePlaceholder')}
          className="min-w-0 w-full bg-transparent text-lg font-semibold text-white placeholder-neutral-600 focus:outline-none"
        />
      ) : (
        <h2 className="min-w-0 break-words text-lg font-semibold text-white">{title || t('notebook.untitled')}</h2>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {isEditing ? (
          <>
            <IconButton label={t('notebook.delete')} tone="danger" className="p-1.5 hover:bg-neutral-800" onClick={onRequestDelete}>
              <TrashIcon className="h-4 w-4" />
            </IconButton>
            <Button type="button" variant="secondary" className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={onCancelEdit}>
              <XIcon className="h-4 w-4" />
              {t('notebook.cancel')}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium" onClick={onRequestEdit}>
            <PencilIcon className="h-3.5 w-3.5" />
            {t('notebook.edit')}
          </Button>
        )}
      </div>
    </div>
  );
}
