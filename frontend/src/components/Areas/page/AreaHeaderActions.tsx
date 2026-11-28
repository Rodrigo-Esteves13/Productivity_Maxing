import Button from '../../UI/Button';
import { HEADER_BUTTON_CLASS } from './areaPageClasses';
import { useI18n } from '../../../i18n/useI18n';
import type { AreasViewState } from '../../../hooks/useAreasView';

export default function AreaHeaderActions({ view }: { view: AreasViewState }) {
  const { t } = useI18n();
  const { areas, selectMode, startSelecting, stopSelecting, isAdmin, openCreateModal } = view;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {areas.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={selectMode}
          onClick={selectMode ? stopSelecting : startSelecting}
          className={HEADER_BUTTON_CLASS}
        >
          {selectMode ? t('areas.select.cancel') : t('areas.select.start')}
        </Button>
      )}
      {isAdmin && (
        <Button variant="secondary" size="sm" onClick={() => openCreateModal('official')} className={HEADER_BUTTON_CLASS}>
          {t('ui.officialArea')}
        </Button>
      )}
      <Button size="sm" onClick={() => openCreateModal('personal')} className={HEADER_BUTTON_CLASS}>
        {t('ui.myArea')}
      </Button>
    </div>
  );
}
