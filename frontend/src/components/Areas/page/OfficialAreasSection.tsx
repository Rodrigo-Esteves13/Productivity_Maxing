import { useId } from 'react';
import EmptyState from '../../UI/EmptyState';
import { ChevronDownIcon } from '../../UI/Icons';
import AreaGrid from '../AreaGrid';
import SectionCount from './SectionCount';
import SectionHeader from './SectionHeader';
import SelectionLinks from './SelectionLinks';
import { areaGridProps } from './areaGridProps';
import { GHOST_BUTTON_CLASS, SECTION_TITLE_CLASS } from './areaPageClasses';
import { useI18n } from '../../../i18n/useI18n';
import type { AreasViewState } from '../../../hooks/useAreasView';

export default function OfficialAreasSection({ view }: { view: AreasViewState }) {
  const { t } = useI18n();
  const officialListId = useId();
  const {
    official,
    officialTotal,
    isOfficialOpen,
    isNarrowed,
    toggleOfficial,
    selectMode,
    handleToggleAllOfficial,
    handleToggleHidden,
  } = view;

  return (
    <section aria-label={t('ui.officialAreas')}>
      <SectionHeader
        heading={
          <h2 className={SECTION_TITLE_CLASS}>
            <button
              type="button"
              aria-expanded={isOfficialOpen}
              aria-controls={officialListId}
              disabled={isNarrowed}
              onClick={toggleOfficial}
              className="-ml-1.5 inline-flex min-h-10 pointer-coarse:min-h-11 items-center gap-2 rounded px-1.5 uppercase tracking-wide transition-colors duration-[var(--duration-quick)] hover:text-white disabled:hover:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <ChevronDownIcon
                aria-hidden="true"
                className={`h-4 w-4 transition-transform duration-[var(--duration-fast)] ease-smooth-out ${
                  isOfficialOpen ? '' : '-rotate-90'
                }`}
              />
              {t('ui.officialAreas')}
              <SectionCount count={official.length} />
            </button>
          </h2>
        }
        actions={
          officialTotal > 0 && isOfficialOpen ? (
            <>
              {selectMode && official.length > 0 && (
                <SelectionLinks
                  ids={official.map((a) => a.id)}
                  selected={view.selectedSet}
                  onSelect={view.selectIds}
                  onDeselect={view.deselectIds}
                />
              )}
              <button type="button" onClick={() => void handleToggleAllOfficial(false)} className={GHOST_BUTTON_CLASS}>
                {t('ui.turnAllOn')}
              </button>
              <button type="button" onClick={() => void handleToggleAllOfficial(true)} className={GHOST_BUTTON_CLASS}>
                {t('ui.turnAllOff')}
              </button>
            </>
          ) : undefined
        }
      />
      {/* Recolhe com grid-rows 1fr/0fr; fechada fica invisivel e inerte
          (sem foco nem leitores de ecra) quando a animacao acaba. */}
      <div
        id={officialListId}
        inert={!isOfficialOpen}
        className={`grid transition-[grid-template-rows,visibility] duration-[var(--duration-fast)] ease-smooth-out ${
          isOfficialOpen ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
        }`}
      >
        {/* -m-1 p-1: o overflow-hidden nao corta aneis de foco nem de arrastar. */}
        <div className="-m-1 min-h-0 overflow-hidden p-1">
          <p className="mb-3 text-xs text-neutral-500">{t('ui.turnedOffAreasDisappearFrom')}</p>
          {officialTotal === 0 ? (
            <EmptyState message={t('ui.noOfficialAreasYet')} />
          ) : (
            <AreaGrid
              areas={official}
              onToggleHidden={(a) => void handleToggleHidden(a)}
              {...areaGridProps(view)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
