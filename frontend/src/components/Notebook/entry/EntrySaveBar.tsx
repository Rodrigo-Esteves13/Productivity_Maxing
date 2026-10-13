import { CheckIcon } from '../../UI/Icons';
import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';

interface EntrySaveBarProps {
  error: string;
  isSaving: boolean;
  isDisabled: boolean;
  onSave: () => void;
}

export default function EntrySaveBar({ error, isSaving, isDisabled, onSave }: EntrySaveBarProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-neutral-600 sm:inline">{t('notebook.saveHint')}</span>
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving || isDisabled}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <CheckIcon className="h-4 w-4" />
          {isSaving ? t('notebook.saving') : t('notebook.save')}
        </Button>
      </div>
    </div>
  );
}
