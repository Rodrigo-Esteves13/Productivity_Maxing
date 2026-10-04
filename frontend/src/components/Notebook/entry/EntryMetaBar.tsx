import type { NotebookEntryType } from '../../../types/models';
import SegmentedControl from '../../UI/SegmentedControl';
import { ENTRY_TYPE_OPTIONS, SMALL_INPUT_CLASS } from './notebookEntryConfig';

interface EntryMetaBarProps {
  isEditing: boolean;
  entryType: NotebookEntryType;
  classNumber: string;
  dateValue: string;
  suggestedClassNumber: number;
  onEntryTypeChange: (type: NotebookEntryType) => void;
  onClassNumberChange: (value: string) => void;
  onDateChange: (value: string) => void;
}

// Tipo (Note/Study/Class), numero da aula e data. Em leitura mostra so
// etiquetas; em edicao mostra os campos.
export default function EntryMetaBar({
  isEditing,
  entryType,
  classNumber,
  dateValue,
  suggestedClassNumber,
  onEntryTypeChange,
  onClassNumberChange,
  onDateChange,
}: EntryMetaBarProps) {
  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 font-medium">
          {ENTRY_TYPE_OPTIONS.find((opt) => opt.value === entryType)?.label ?? entryType}
        </span>
        {entryType === 'CLASS' && classNumber && <span>Class #{classNumber}</span>}
        <span>{dateValue}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl size="sm" options={ENTRY_TYPE_OPTIONS} value={entryType} onChange={onEntryTypeChange} />

      {entryType === 'CLASS' && (
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          Class #
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
        Date
        <input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)} className={SMALL_INPUT_CLASS} />
      </label>
    </div>
  );
}
