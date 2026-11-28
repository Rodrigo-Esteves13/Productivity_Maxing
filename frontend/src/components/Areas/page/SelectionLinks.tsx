import { selectionState } from '../../../lib/areaSections';
import { useI18n } from '../../../i18n/useI18n';
import { GHOST_BUTTON_CLASS } from './areaPageClasses';

interface SelectionLinksProps {
  ids: string[];
  selected: ReadonlySet<string>;
  onSelect: (ids: string[]) => void;
  onDeselect: (ids: string[]) => void;
}

// "Select all" / "None" de uma seccao (ou de todas, na barra fixa).
export default function SelectionLinks({ ids, selected, onSelect, onDeselect }: SelectionLinksProps) {
  const { t } = useI18n();
  const { allSelected, anySelected } = selectionState(ids, selected);
  return (
    <div className="flex gap-1">
      <button type="button" onClick={() => onSelect(ids)} disabled={allSelected} className={GHOST_BUTTON_CLASS}>
        {t('areas.select.all')}
      </button>
      <button type="button" onClick={() => onDeselect(ids)} disabled={!anySelected} className={GHOST_BUTTON_CLASS}>
        {t('areas.select.none')}
      </button>
    </div>
  );
}
