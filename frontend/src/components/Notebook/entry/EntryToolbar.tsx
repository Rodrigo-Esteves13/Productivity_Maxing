import type { NotebookEntryType } from '../../../types/models';
import { CheckIcon, DownloadIcon, EyeOffIcon, PencilIcon, RedoIcon, TrashIcon, UndoIcon } from '../../UI/Icons';
import Button from '../../UI/Button';
import IconButton from '../../UI/IconButton';
import ToggleChip from '../../UI/ToggleChip';
import SegmentedControl from '../../UI/SegmentedControl';
import { useI18n } from '../../../i18n/useI18n';
import { ENTRY_TYPE_ICON, useEntryTypeOptions } from '../../../hooks/useEntryTypeOptions';
import type { AutosaveStatus } from '../../../hooks/useEntryAutosave';
import { SMALL_INPUT_CLASS } from './notebookEntryConfig';

interface EntryToolbarProps {
  isEditing: boolean;
  entryType: NotebookEntryType;
  classNumber: string;
  dateValue: string;
  suggestedClassNumber: number;
  autosaveStatus: AutosaveStatus;
  autosaveSavedAt: Date | null;
  autosaveError: string;
  isDoneDisabled: boolean;
  privateFromFriends: boolean;
  onPrivateToggle: () => void;
  autosaveEnabled: boolean;
  onAutosaveToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onEntryTypeChange: (type: NotebookEntryType) => void;
  onClassNumberChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onRequestEdit: () => void;
  onDone: () => void;
  onRetry: () => void;
  onRequestDelete: () => void;
  onExport?: () => void;
}

function AutosaveIndicator({
  status,
  savedAt,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  savedAt: Date | null;
  error: string;
  onRetry: () => void;
}) {
  const { t, lang } = useI18n();

  if (status === 'error') {
    return (
      <span role="alert" className="flex items-center gap-2 text-xs text-red-400" title={error}>
        {t('notebook.autosave.error')}
        <button type="button" onClick={onRetry} className="font-medium underline hover:text-red-300">
          {t('notebook.autosave.retry')}
        </button>
      </span>
    );
  }

  let label = '';
  if (status === 'saving') label = t('notebook.autosave.saving');
  else if (status === 'pending') label = t('notebook.autosave.pending');
  else if (status === 'saved' && savedAt) {
    label = t('notebook.autosave.saved', {
      time: savedAt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return (
    <span role="status" aria-live="polite" className="text-xs text-neutral-500">
      {label}
    </span>
  );
}

// Barra fixa no topo da folha: tipo/numero/data a esquerda, estado do auto
// save e acoes a direita. Fica colada por baixo da navbar ao fazer scroll,
// por isso "Done" esta sempre ao alcance, mesmo em entradas compridas.
export default function EntryToolbar({
  isEditing,
  entryType,
  classNumber,
  dateValue,
  suggestedClassNumber,
  autosaveStatus,
  autosaveSavedAt,
  autosaveError,
  isDoneDisabled,
  privateFromFriends,
  onPrivateToggle,
  autosaveEnabled,
  onAutosaveToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onEntryTypeChange,
  onClassNumberChange,
  onDateChange,
  onRequestEdit,
  onDone,
  onRetry,
  onRequestDelete,
  onExport,
}: EntryToolbarProps) {
  const { t, lang } = useI18n();
  const typeOptions = useEntryTypeOptions();
  const TypeIcon = ENTRY_TYPE_ICON[entryType];

  const longDate = new Date(`${dateValue}T12:00:00`).toLocaleDateString(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-t-xl border-b border-neutral-800 bg-neutral-900/95 px-4 py-2.5 backdrop-blur sm:px-6">
      {isEditing ? (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl size="sm" options={typeOptions} value={entryType} onChange={onEntryTypeChange} />
          {entryType === 'CLASS' && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              {t('notebook.classNumber')}
              <input
                type="number"
                min={1}
                value={classNumber}
                onChange={(e) => onClassNumberChange(e.target.value)}
                placeholder={String(suggestedClassNumber)}
                className={`w-16 ${SMALL_INPUT_CLASS}`}
              />
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            {t('notebook.date')}
            <input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)} className={SMALL_INPUT_CLASS} />
          </label>
          <ToggleChip
            size="sm"
            pressed={privateFromFriends}
            onClick={onPrivateToggle}
            title={t('notebook.private.hint')}
            className="flex items-center gap-1.5 py-1 text-xs"
          >
            <EyeOffIcon className="h-3.5 w-3.5" />
            {t('notebook.private.toggle')}
          </ToggleChip>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 font-medium text-neutral-200">
            <TypeIcon className="h-3.5 w-3.5 text-violet-400" />
            {typeOptions.find((opt) => opt.value === entryType)?.label}
          </span>
          {entryType === 'CLASS' && classNumber && <span>{t('notebook.classLabel', { n: classNumber })}</span>}
          <span>{longDate}</span>
          {privateFromFriends && (
            <span className="flex items-center gap-1 text-neutral-500" title={t('notebook.private.hint')}>
              <EyeOffIcon className="h-3.5 w-3.5" />
              {t('notebook.private.badge')}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <AutosaveIndicator status={autosaveStatus} savedAt={autosaveSavedAt} error={autosaveError} onRetry={onRetry} />
            <ToggleChip
              size="sm"
              pressed={autosaveEnabled}
              onClick={onAutosaveToggle}
              title={t('notebook.autosave.toggleHint')}
              className="py-1 text-xs"
            >
              {t('notebook.autosave.toggle')}
            </ToggleChip>
            <IconButton label={t('notebook.undo')} className="hover:bg-neutral-800" onClick={onUndo} disabled={!canUndo}>
              <UndoIcon className="h-4 w-4" />
            </IconButton>
            <IconButton label={t('notebook.redo')} className="hover:bg-neutral-800" onClick={onRedo} disabled={!canRedo}>
              <RedoIcon className="h-4 w-4" />
            </IconButton>
            <IconButton label={t('notebook.delete')} tone="danger" className="hover:bg-neutral-800" onClick={onRequestDelete}>
              <TrashIcon className="h-4 w-4" />
            </IconButton>
            <Button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              onClick={onDone}
              disabled={isDoneDisabled}
              title={t('notebook.doneHint')}
            >
              <CheckIcon className="h-4 w-4" />
              {t('notebook.done')}
            </Button>
          </>
        ) : (
          <>
            {onExport && (
              <IconButton label={t('notebook.export.entry')} className="hover:bg-neutral-800" onClick={onExport}>
                <DownloadIcon className="h-4 w-4" />
              </IconButton>
            )}
            <Button
              type="button"
              variant="secondary"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              onClick={onRequestEdit}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {t('notebook.edit')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
