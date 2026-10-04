import { PencilIcon, TrashIcon, XIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';

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
  return (
    <div className="flex items-start justify-between gap-3">
      {isEditing ? (
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Entry title"
          className="min-w-0 w-full bg-transparent text-lg font-semibold text-white placeholder-neutral-600 focus:outline-none"
        />
      ) : (
        <h2 className="min-w-0 break-words text-lg font-semibold text-white">{title || 'Untitled entry'}</h2>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {isEditing ? (
          <>
            <IconButton label="Delete entry" tone="danger" className="p-1.5 hover:bg-neutral-800" onClick={onRequestDelete}>
              <TrashIcon className="h-4 w-4" />
            </IconButton>
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRequestEdit}
            className="flex items-center gap-1 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
