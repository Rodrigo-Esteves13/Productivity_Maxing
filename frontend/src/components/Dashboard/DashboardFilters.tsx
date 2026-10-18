import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';
import SavedFilterViews from './SavedFilterViews';
import SortDirectionButton from '../UI/SortDirectionButton';
import { TASKS_TABLE_COLUMNS, type TasksTableColumnId } from '../../lib/tasksTableColumns';
import { isSortableColumn } from '../../utils/taskSorting';
import type { TableSortState } from '../../hooks/useTableSort';
import type { Area, AcademicTaskTypeOption } from '../../types/models';
import type { DashboardFiltersState } from './dashboardFilters.types';
import { ACADEMIC_TASK_TYPE_KEY } from '../../lib/constants';

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onChange: (filters: DashboardFiltersState) => void;
  areas: Area[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses: string[];
  onClear: () => void;
  sort: TableSortState<TasksTableColumnId> | null;
  onSortKeyChange: (key: TasksTableColumnId | null) => void;
  onToggleSortDirection: () => void;
}

const SORT_OPTIONS = TASKS_TABLE_COLUMNS.filter((column) => isSortableColumn(column.id));

// Texto do botao de direcao: o que 'asc' significa depende da coluna.
function directionKeys(key: TasksTableColumnId): { asc: string; desc: string } {
  switch (key) {
    case 'date':
      return { asc: 'sort.nearest', desc: 'sort.furthest' };
    case 'priority':
      return { asc: 'sort.highest', desc: 'sort.lowest' };
    case 'difficulty':
    case 'status':
      return { asc: 'sort.lowToHigh', desc: 'sort.highToLow' };
    case 'grade':
      return { asc: 'sort.lowest', desc: 'sort.highest' };
    default:
      return { asc: 'sort.aToZ', desc: 'sort.zToA' };
  }
}

export default function DashboardFilters({
  filters,
  onChange,
  areas,
  academicTaskTypes,
  difficulties,
  progressStatuses,
  onClear,
  sort,
  onSortKeyChange,
  onToggleSortDirection,
}: DashboardFiltersProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const update = (patch: Partial<DashboardFiltersState>) => onChange({ ...filters, ...patch });
  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
        <FormField label={t('filters.search')} htmlFor="filter-search" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Input
            id="filter-search"
            placeholder={t('filters.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </FormField>

        <FormField label={t('filters.area')} htmlFor="filter-area">
          {/* O Dashboard já só passa aqui as Areas que têm tasks Académicas
              a sério - não precisa de mais filtragem por Type aqui dentro,
              o Dashboard inteiro já é implicitamente "só Académico". */}
          <Select id="filter-area" value={filters.areaId} onChange={(e) => update({ areaId: e.target.value })}>
            <option value="">{t('filters.allAreas')}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('filters.academicType')} htmlFor="filter-academic-type">
          <Select
            id="filter-academic-type"
            value={filters.academicType}
            onChange={(e) => update({ academicType: e.target.value })}
          >
            <option value="">{t('filters.allAcademicTypes')}</option>
            {academicTaskTypes
              .filter((option) => option.taskTypeKey === ACADEMIC_TASK_TYPE_KEY)
              .map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
          </Select>
        </FormField>

        <FormField label={t('filters.difficulty')} htmlFor="filter-difficulty">
          <Select
            id="filter-difficulty"
            value={filters.difficulty}
            onChange={(e) => update({ difficulty: e.target.value })}
          >
            <option value="">{t('filters.all')}</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {enumLabel(d)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('filters.status')} htmlFor="filter-status">
          <Select
            id="filter-status"
            value={filters.progressStatus}
            onChange={(e) => update({ progressStatus: e.target.value })}
          >
            <option value="">{t('filters.all')}</option>
            {progressStatuses.map((s) => (
              <option key={s} value={s}>
                {enumLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex flex-wrap items-end justify-between gap-4">
          <FormField label={t('filters.due')} htmlFor="filter-due" className="w-40">
            <Select id="filter-due" value={filters.dateStatus} onChange={(e) => update({ dateStatus: e.target.value })}>
              <option value="">{t('filters.all')}</option>
              <option value="overdue">{t('filters.overdue')}</option>
              <option value="today">{t('filters.dueToday')}</option>
              <option value="upcoming">{t('filters.upcoming')}</option>
              <option value="completed">{t('filters.completed')}</option>
            </Select>
          </FormField>

          <div className="flex items-end gap-2">
            <FormField label={t('filters.sortBy')} htmlFor="filter-sort" className="w-44">
              <Select
                id="filter-sort"
                value={sort?.key ?? ''}
                onChange={(e) => onSortKeyChange(e.target.value === '' ? null : (e.target.value as TasksTableColumnId))}
              >
                <option value="">{t('filters.defaultOrder')}</option>
                {SORT_OPTIONS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {t(column.labelKey)}
                  </option>
                ))}
              </Select>
            </FormField>
            {sort && (
              <SortDirectionButton
                direction={sort.direction}
                onToggle={onToggleSortDirection}
                ascLabel={t(directionKeys(sort.key).asc)}
                descLabel={t(directionKeys(sort.key).desc)}
              />
            )}
          </div>

          {hasActiveFilters && (
            <Button type="button" variant="secondary" onClick={onClear}>
              {t('filters.clear')}
            </Button>
          )}
        </div>
      </div>

      <SavedFilterViews filters={filters} hasActiveFilters={hasActiveFilters} onApply={onChange} />
    </div>
  );
}
