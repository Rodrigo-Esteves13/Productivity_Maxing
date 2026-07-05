import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import { formatEnumLabel } from '../../utils/formatEnumLabel';
import type { Area, TaskTypeOption } from '../../types/models';
import type { DashboardFiltersState } from './dashboardFilters.types';

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onChange: (filters: DashboardFiltersState) => void;
  areas: Area[];
  taskTypes: TaskTypeOption[];
  difficulties: string[];
  progressStatuses: string[];
  onClear: () => void;
}

export default function DashboardFilters({
  filters,
  onChange,
  areas,
  taskTypes,
  difficulties,
  progressStatuses,
  onClear,
}: DashboardFiltersProps) {
  const update = (patch: Partial<DashboardFiltersState>) => onChange({ ...filters, ...patch });
  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
        <FormField label="Search" htmlFor="filter-search" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Input
            id="filter-search"
            placeholder="Search by title..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </FormField>

        <FormField label="Area" htmlFor="filter-area">
          <Select id="filter-area" value={filters.areaId} onChange={(e) => update({ areaId: e.target.value })}>
            <option value="">All Areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Type" htmlFor="filter-type">
          <Select id="filter-type" value={filters.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">All Types</option>
            {taskTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Difficulty" htmlFor="filter-difficulty">
          <Select
            id="filter-difficulty"
            value={filters.difficulty}
            onChange={(e) => update({ difficulty: e.target.value })}
          >
            <option value="">All</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {formatEnumLabel(d)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Status" htmlFor="filter-status">
          <Select
            id="filter-status"
            value={filters.progressStatus}
            onChange={(e) => update({ progressStatus: e.target.value })}
          >
            <option value="">All</option>
            {progressStatuses.map((s) => (
              <option key={s} value={s}>
                {formatEnumLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Due" htmlFor="filter-due">
          <Select id="filter-due" value={filters.dateStatus} onChange={(e) => update({ dateStatus: e.target.value })}>
            <option value="">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </Select>
        </FormField>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end mt-4">
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
