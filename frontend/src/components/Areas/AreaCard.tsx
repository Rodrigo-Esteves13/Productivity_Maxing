import { PencilIcon, TrashIcon } from '../UI/Icons';
import ColorDot from '../UI/ColorDot';
import AreaStatusBadge from './AreaStatusBadge';
import type { Area } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface AreaCardProps {
  area: Area;
  canManage: boolean;
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
  // Só para oficiais: liga/desliga para o próprio utilizador.
  onToggleHidden?: (area: Area) => void;
}

export default function AreaCard({ area, canManage, onSelect, onEdit, onDelete, onToggleHidden }: AreaCardProps) {
  const { t } = useI18n();
  return (
    <div
      className={`p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors ${
        area.isHidden ? 'opacity-50' : ''
      }`}
    >
      <div
        className="flex items-center gap-3 truncate cursor-pointer flex-1"
        onClick={() => onSelect(area)}
        title={t('ui.viewDetails')}
      >
        <ColorDot color={area.colorHex} variant="circle" size="sm" />
        <span className="font-medium text-white truncate">{area.name}</span>
        {!area.isOfficial && <AreaStatusBadge area={area} />}
      </div>

      {area.isOfficial && onToggleHidden && (
        <button
          type="button"
          role="switch"
          aria-checked={!area.isHidden}
          aria-label={`${area.name} ${area.isHidden ? 'off' : 'on'}`}
          title={area.isHidden ? t('ui.offHiddenFromYourLists') : t('ui.onClickToHideFrom')}
          onClick={() => onToggleHidden(area)}
          className={`ml-2 relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            area.isHidden ? 'bg-neutral-700' : 'bg-violet-600'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              area.isHidden ? 'left-0.5' : 'left-[1.125rem]'
            }`}
          />
        </button>
      )}

      {canManage && (
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onEdit(area)}
            className="text-neutral-500 hover:text-white transition-colors p-1.5"
            title={t('ui.editArea')}
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onDelete(area.id)}
            className="text-neutral-500 hover:text-red-500 transition-colors p-1.5"
            title={t('ui.deleteArea')}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}
