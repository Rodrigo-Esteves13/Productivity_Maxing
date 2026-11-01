import { PencilIcon, TrashIcon, UndoIcon, CheckIcon, PinIcon, PinOffIcon, DuplicateIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';
import IconButton from './IconButton';

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
        <IconButton
          label={isPinned ? t('ui.unpinTask') : t('ui.pinTask')}
          aria-pressed={isPinned}
          onClick={onTogglePin}
          className={isPinned ? 'text-violet-400 hover:text-violet-300' : 'text-neutral-400 hover:text-violet-400'}
        >
          {/* Os dois icones ficam montados e trocam com fade/scale/blur. */}
          <span className="icon-swap" aria-hidden="true">
            <PinIcon data-shown={!isPinned} />
            <PinOffIcon data-shown={isPinned} />
          </span>
        </IconButton>
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