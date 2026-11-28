import { useI18n } from '../../i18n/useI18n';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { PlusIcon } from '../UI/Icons';
import { QUICK_ADD_DIFFICULTY, QUICK_ADD_TASK_TYPE, type QuickAddItem } from './buildPaletteItems';

interface PaletteQuickAddRowProps {
  item: QuickAddItem;
  rowClass: string;
  isCreating: boolean;
  // Areas ja carregadas (so entao faz sentido avisar que falta uma).
  areasLoaded: boolean;
  onSelect: () => void;
  onHover: () => void;
}

// Linha "criar task" do quick-add.
export default function PaletteQuickAddRow({ item, rowClass, isCreating, areasLoaded, onSelect, onHover }: PaletteQuickAddRowProps) {
  const { t } = useI18n();
  const { catalogLabel } = useCatalogLabel();
  const enumLabel = useEnumLabel();
  const noArea = areasLoaded && !item.area;
  const dateLabel = item.time ? `${item.dateKey} ${item.time}` : item.dateKey;
  return (
    <button
      type="button"
      disabled={isCreating || !item.area}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`${rowClass} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <PlusIcon className="shrink-0 text-violet-400" />
        <span className="truncate" title={isCreating ? t('palette.creating') : t('palette.create', { title: item.title })}>
          {isCreating ? t('palette.creating') : t('palette.create', { title: item.title })}
        </span>
      </span>
      <span className="text-[10px] text-neutral-500 shrink-0 text-right">
        {noArea
          ? t('palette.needArea')
          : t('palette.meta', {
              area: item.area?.name ?? '...',
              date: dateLabel,
              // Rotulos traduzidos (antes mostrava as chaves cruas,
              // ex: "academico, medium").
              details: `${catalogLabel('taskType', QUICK_ADD_TASK_TYPE, null)}, ${enumLabel(QUICK_ADD_DIFFICULTY)}${
                item.priority ? `, ${t('palette.priorityTag', { level: catalogLabel('priority', item.priority, null) })}` : ''
              }`,
            })}
      </span>
    </button>
  );
}
