import Button from '../../UI/Button';
import EmptyState from '../../UI/EmptyState';
import { PlusIcon } from '../../UI/Icons';
import AreaGrid from '../AreaGrid';
import SectionCount from './SectionCount';
import SectionHeader from './SectionHeader';
import SelectionLinks from './SelectionLinks';
import { areaGridProps } from './areaGridProps';
import { HEADER_BUTTON_CLASS, SECTION_TITLE_CLASS } from './areaPageClasses';
import { useI18n } from '../../../i18n/useI18n';
import type { AreasViewState } from '../../../hooks/useAreasView';

export default function PersonalAreasSection({ view }: { view: AreasViewState }) {
  const { t } = useI18n();
  const { personal, personalTotal, selectMode, openCreateModal } = view;

  const createFirstAction = (
    <Button size="sm" onClick={() => openCreateModal('personal')} className={HEADER_BUTTON_CLASS}>
      <PlusIcon aria-hidden="true" className="h-4 w-4" />
      {t('areas.empty.createFirst')}
    </Button>
  );

  return (
    <section className="mb-10" aria-label={t('ui.myAreas')}>
      <SectionHeader
        heading={
          <h2 className={`flex items-center gap-2 ${SECTION_TITLE_CLASS}`}>
            {t('ui.myAreas')}
            <SectionCount count={personal.length} />
          </h2>
        }
        actions={
          selectMode && personal.length > 0 ? (
            <SelectionLinks
              ids={personal.map((a) => a.id)}
              selected={view.selectedSet}
              onSelect={view.selectIds}
              onDeselect={view.deselectIds}
            />
          ) : undefined
        }
      />
      {personalTotal === 0 ? (
        <EmptyState message={t('ui.youHaveNoPersonalAreas')} action={createFirstAction} />
      ) : (
        <AreaGrid areas={personal} {...areaGridProps(view)} />
      )}
    </section>
  );
}
