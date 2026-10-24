import { PencilIcon, TrashIcon, UndoIcon, CheckIcon, PinIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';
import IconButton from './IconButton';

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
  editTitle,
  cancelEditTitle,
  duplicateTitle,
  completeTitle,
}: ModalHeaderActionsProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      {/* Botão de Pin - antes de tudo, sempre visível fora de edição */}
      {!isEditing && onTogglePin && (
        <button
          onClick={onTogglePin}
          title={isPinned ? t('ui.unpinTask') : t('ui.pinTask')}
          className={`transition-colors p-1 ${
            isPinned ? 'text-violet-400 hover:text-violet-300' : 'text-neutral-400 hover:text-violet-400'
          }`}
        >
          <PinIcon />
        </button>
      )}

      {/* Botão de Marcar como Concluída - antes do Duplicar, só fora de edição */}
      {!isEditing && onComplete && (
        <IconButton
          label={completeTitle ?? t('ui.markComplete')}
          onClick={onComplete}
          className="text-neutral-400 hover:text-violet-400"
        >
          <CheckIcon />
        </IconButton>
      )}

      {/* Botão de Duplicar - Aparece antes do Apagar e esconde-se durante a edição */}
      {!isEditing && onDuplicate && (
        <IconButton
          label={duplicateTitle ?? t('hook.duplicate')}
          onClick={onDuplicate}
          className="text-neutral-400"
        >
          <DuplicateIcon />
        </IconButton>
      )}

      {/* Botão de Apagar (mantém o teu estilo original) */}
      {!isEditing && (
        <IconButton
          label={deleteTitle}
          onClick={onDelete}
          className="text-neutral-400 hover:text-red-500"
        >
          <TrashIcon />
        </IconButton>
      )}

      {/* Botão de Editar / Cancelar (mantém o teu estilo original) */}
      <IconButton
        label={isEditing ? (cancelEditTitle ?? t('ui.cancelEdit')) : (editTitle ?? t('notebook.edit'))}
        onClick={onToggleEdit}
        className="text-neutral-400 hover:text-white"
      >
        {isEditing ? <UndoIcon /> : <PencilIcon />}
      </IconButton>
    </div>
  );
}