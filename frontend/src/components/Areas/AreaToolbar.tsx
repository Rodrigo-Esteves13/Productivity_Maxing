import Input from '../UI/Input';
import Select from '../UI/Select';
import SegmentedControl, { type SegmentedOption } from '../UI/SegmentedControl';
import { SearchIcon } from '../UI/Icons';
import { AREA_FILTERS, AREA_SORTS, type AreaFilter, type AreaSort } from '../../lib/areaList';
import { useI18n } from '../../i18n/useI18n';

interface AreaToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: AreaFilter;
  onFilterChange: (value: AreaFilter) => void;
  sort: AreaSort;
  onSortChange: (value: AreaSort) => void;
  shownCount: number;
  totalCount: number;
  // Pesquisa ou filtro a esconder areas: mostra a contagem e o "limpar".
  isNarrowed: boolean;
  onResetFilters: () => void;
  // Ordem manual personalizada (so faz sentido com a ordenacao manual).
  showResetOrder: boolean;
  onResetOrder: () => void;
}

const FILTER_LABEL_KEY: Record<AreaFilter, string> = {
  all: 'areas.filter.all',
  on: 'areas.filter.on',
  off: 'areas.filter.off',
};

const SORT_LABEL_KEY: Record<AreaSort, string> = {
  manual: 'areas.sort.manual',
  name: 'areas.sort.name',
  risk: 'areas.sort.risk',
  tasks: 'areas.sort.tasks',
};

const LINK_BUTTON_CLASS =
  'inline-flex min-h-10 items-center rounded px-1 text-xs font-medium text-violet-400 transition-colors duration-[var(--duration-quick)] hover:text-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400';

// Pesquisa, filtro Ligadas/Desligadas e ordenacao da pagina Areas.
export default function AreaToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  shownCount,
  totalCount,
  isNarrowed,
  onResetFilters,
  showResetOrder,
  onResetOrder,
}: AreaToolbarProps) {
  const { t } = useI18n();
  const filterOptions: SegmentedOption<AreaFilter>[] = AREA_FILTERS.map((value) => ({
    value,
    label: t(FILTER_LABEL_KEY[value]),
  }));

  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.preventDefault();
                onSearchChange('');
              }
            }}
            placeholder={t('areas.search.placeholder')}
            aria-label={t('areas.search.placeholder')}
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <div role="group" aria-label={t('areas.filter.label')}>
            <SegmentedControl options={filterOptions} value={filter} onChange={onFilterChange} />
          </div>
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <Select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as AreaSort)}
              aria-label={t('areas.sort.label')}
              title={t('areas.sort.label')}
            >
              {AREA_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(SORT_LABEL_KEY[value])}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {(isNarrowed || showResetOrder) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          {isNarrowed ? (
            <p role="status" className="text-xs tabular-nums text-neutral-400">
              {t('areas.results', { shown: shownCount, total: totalCount })}
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {isNarrowed && (
              <button type="button" onClick={onResetFilters} className={LINK_BUTTON_CLASS}>
                {t('areas.empty.reset')}
              </button>
            )}
            {showResetOrder && (
              <button type="button" onClick={onResetOrder} className={LINK_BUTTON_CLASS}>
                {t('areaOrder.reset')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
