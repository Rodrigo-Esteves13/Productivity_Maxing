import Select from '../UI/Select';
import { useAcademic } from '../../context/useAcademic';

// Lives next to ProgramSelector, always in this order (Program -> Period).
export default function PeriodSelector() {
  const {
    periods,
    activePeriod,
    isViewingAllPeriods,
    switchPeriod,
    showArchivedPeriods,
    toggleShowArchivedPeriods,
    isLoading,
  } = useAcademic();

  if (isLoading) return null;

  const hasArchived = periods.some((p) => p.isArchived);
  const visiblePeriods = periods.filter((p) => showArchivedPeriods || !p.isArchived);

  // Nothing worth picking yet (a program just created with no periods, or
  // a single non-archived period with nothing to compare against) - not
  // worth cluttering the top of the page with a one-option dropdown. If
  // there are archived periods hiding behind the toggle, still show the
  // toggle so they're reachable.
  if (visiblePeriods.length <= 1 && !hasArchived) return null;

  const value = isViewingAllPeriods ? 'all' : (activePeriod?.id ?? '');

  return (
    <div className="flex items-center gap-2">
      {visiblePeriods.length > 1 && (
        <Select
          aria-label="Active period"
          className="w-auto min-w-[220px]"
          value={value}
          onChange={(e) => switchPeriod(e.target.value)}
        >
          {[...visiblePeriods]
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
            .map((period) => (
              <option
                key={period.id}
                value={period.id}
                className={period.isArchived ? 'text-neutral-500' : undefined}
              >
                {period.isPinned ? '📌 ' : ''}
                {period.name}
                {period.isArchived ? ' (archived)' : ''}
              </option>
            ))}
          <option value="all">View all periods</option>
        </Select>
      )}

      {hasArchived && (
        <label className="flex items-center gap-1.5 text-xs text-neutral-400 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showArchivedPeriods}
            onChange={toggleShowArchivedPeriods}
            className="accent-violet-500"
          />
          Show archived
        </label>
      )}
    </div>
  );
}
