import { PencilIcon, TrashIcon, XIcon } from './icons';

interface ModalHeaderActionsProps {
  isEditing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  deleteTitle?: string;
  editTitle?: string;
  cancelEditTitle?: string;
}

export default function ModalHeaderActions({
  isEditing,
  onToggleEdit,
  onDelete,
  deleteTitle = 'Apagar',
  editTitle = 'Editar',
  cancelEditTitle = 'Cancelar edição',
}: ModalHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDelete}
        title={deleteTitle}
        className="text-neutral-400 hover:text-red-500 transition-colors p-1"
      >
        <TrashIcon />
      </button>
      <button
        onClick={onToggleEdit}
        aria-label={isEditing ? cancelEditTitle : editTitle}
        title={isEditing ? cancelEditTitle : editTitle}
        className="text-neutral-400 hover:text-white transition-colors p-1"
      >
        {isEditing ? <XIcon /> : <PencilIcon />}
      </button>
    </div>
  );
}
