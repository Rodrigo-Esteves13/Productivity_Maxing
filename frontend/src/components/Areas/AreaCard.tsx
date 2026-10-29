import { PencilIcon, TrashIcon } from '../UI/Icons';
import ColorDot from '../UI/ColorDot';
import AreaStatusBadge from './AreaStatusBadge';
import type { Area } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

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
        area.isHidden ? 'opacity-70' : ''
      }`}
    >
      {/* button e nao div com onClick: com o teclado os detalhes da area
          nao abriam de todo. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={() => onSelect(area)}
          title={t('ui.viewDetails')}
          className="flex min-w-0 items-center gap-3 rounded text-left"
        >
          <ColorDot color={area.colorHex} variant="circle" size="sm" />
          <span className="font-medium text-white truncate">{area.name}</span>
        </button>
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
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-[var(--duration-fast)] ease-smooth-out ${
              area.isHidden ? 'translate-x-0' : 'translate-x-4'
            }`}
          />
        </button>
      )}

      {canManage && (
        <div className="flex items-center gap-1 ml-2">
          <IconButton
            label={t('ui.editArea')}
            onClick={() => onEdit(area)}
            className="text-neutral-500 hover:text-white"
          >
            <PencilIcon />
          </IconButton>
          <IconButton
            label={t('ui.deleteArea')}
            onClick={() => onDelete(area.id)}
            className="text-neutral-500 hover:text-red-500"
          >
            <TrashIcon />
          </IconButton>
        </div>
      )}
    </div>
  );
}
