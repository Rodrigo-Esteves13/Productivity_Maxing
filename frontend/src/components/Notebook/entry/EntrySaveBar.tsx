import { CheckIcon } from '../../UI/Icons';

interface EntrySaveBarProps {
  error: string;
  isSaving: boolean;
  isDisabled: boolean;
  onSave: () => void;
}

export default function EntrySaveBar({ error, isSaving, isDisabled, onSave }: EntrySaveBarProps) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || isDisabled}
        className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        <CheckIcon className="h-4 w-4" />
        {isSaving ? 'Saving...' : 'Save entry'}
      </button>
    </div>
  );
}
