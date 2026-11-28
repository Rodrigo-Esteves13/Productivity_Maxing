import Button from '../../UI/Button';
import SelectionLinks from './SelectionLinks';
import { HEADER_BUTTON_CLASS } from './areaPageClasses';
import { useI18n } from '../../../i18n/useI18n';
import type { AreasViewState } from '../../../hooks/useAreasView';

// Espelho do limite do backend para aplicar regras em massa.
const BULK_AREAS_MAX = 500;

// Barra fixa do modo de selecao.
export default function AreaSelectionBar({ view }: { view: AreasViewState }) {
  const { t } = useI18n();
  const { selectedIds, stopSelecting } = view;

  return (
    <div
      role="region"
      aria-label={t('areas.select.start')}
      // Preso ao fundo acima da area segura (iPhone); dentro do fluxo,
      // por isso no fim da pagina nunca tapa o ultimo cartao.
      className="motion-toast sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mt-6 flex flex-col gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 sm:justify-start">
        <span role="status" className="text-sm font-medium tabular-nums text-white">
          {t('areas.select.count', { count: selectedIds.length })}
        </span>
        <SelectionLinks
          ids={view.visible.map((a) => a.id)}
          selected={view.selectedSet}
          onSelect={view.selectIds}
          onDeselect={view.deselectIds}
        />
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={stopSelecting} className={`${HEADER_BUTTON_CLASS} flex-1 justify-center sm:flex-none`}>
            {t('areas.select.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.length === 0 || selectedIds.length > BULK_AREAS_MAX}
            onClick={() => view.setIsBulkOpen(true)}
            className={`${HEADER_BUTTON_CLASS} flex-1 justify-center sm:flex-none`}
          >
            {t('areas.select.setRules')}
          </Button>
        </div>
        {selectedIds.length > BULK_AREAS_MAX && (
          <p role="alert" className="text-xs text-neutral-400">
            {t('areas.select.limit', { max: BULK_AREAS_MAX })}
          </p>
        )}
      </div>
    </div>
  );
}
