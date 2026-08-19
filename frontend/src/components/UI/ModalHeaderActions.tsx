import { PencilIcon, TrashIcon, UndoIcon, CheckIcon, PinIcon } from './Icons';

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
  // Omit entirely when the task is already completed (or completion
  // doesn't apply in this context) - see the ternary passed in from
  // Tasks.tsx, same "undefined hides the button" convention as
  // onDuplicate above.
  onComplete?: () => void;
  // isPinned only matters together with onTogglePin - it's what decides
  // the icon's color and the tooltip text (Pin vs Unpin).
  isPinned?: boolean;
  onTogglePin?: () => void;
  deleteTitle?: string;
  editTitle?: string;
  cancelEditTitle?: string;
  duplicateTitle?: string;
  completeTitle?: string;
}

export default function ModalHeaderActions({
  isEditing,
  onToggleEdit,
  onDelete,
  onDuplicate,
  onComplete,
  isPinned = false,
  onTogglePin,
  deleteTitle = 'Delete',
  editTitle = 'Edit',
  cancelEditTitle = 'Cancel edit',
  duplicateTitle = 'Duplicate',
  completeTitle = 'Mark complete',
}: ModalHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Botão de Pin - antes de tudo, sempre visível fora de edição */}
      {!isEditing && onTogglePin && (
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Unpin task' : 'Pin task'}
          className={`transition-colors p-1 ${
            isPinned ? 'text-violet-400 hover:text-violet-300' : 'text-neutral-400 hover:text-violet-400'
          }`}
        >
          <PinIcon />
        </button>
      )}

      {/* Botão de Marcar como Concluída - antes do Duplicar, só fora de edição */}
      {!isEditing && onComplete && (
        <button
          onClick={onComplete}
          title={completeTitle}
          className="text-neutral-400 hover:text-emerald-400 transition-colors p-1"
        >
          <CheckIcon />
        </button>
      )}

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
        {isEditing ? <UndoIcon /> : <PencilIcon />}
      </button>
    </div>
  );
}