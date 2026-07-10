import { PencilIcon, TrashIcon, XIcon } from './Icons';

const DuplicateIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

interface ModalHeaderActionsProps {
  isEditing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  deleteTitle?: string;
  editTitle?: string;
  cancelEditTitle?: string;
  duplicateTitle?: string;
}

export default function ModalHeaderActions({
  isEditing,
  onToggleEdit,
  onDelete,
  onDuplicate,
  deleteTitle = 'Delete',
  editTitle = 'Edit',
  cancelEditTitle = 'Cancel edit',
  duplicateTitle = 'Duplicate',
}: ModalHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Botão de Duplicar - Aparece antes do Apagar e esconde-se durante a edição */}
      {!isEditing && onDuplicate && (
        <button
          onClick={onDuplicate}
          title={duplicateTitle}
          className="text-neutral-400 hover:text-blue-400 transition-colors p-1"
        >
          <DuplicateIcon />
        </button>
      )}

      {/* Botão de Apagar (mantém o teu estilo original) */}
      {!isEditing && (
        <button
          onClick={onDelete}
          title={deleteTitle}
          className="text-neutral-400 hover:text-red-500 transition-colors p-1"
        >
          <TrashIcon />
        </button>
      )}

      {/* Botão de Editar / Cancelar (mantém o teu estilo original) */}
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