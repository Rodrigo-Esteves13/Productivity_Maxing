import { useEffect, useRef, useState } from 'react';
import { useAcademic } from '../../context/useAcademic';
import { PinIcon, ChevronDownIcon } from '../UI/Icons';
import type { AcademicPeriod } from '../../types/models';

// Lives next to ProgramSelector, always in this order (Program -> Period).
//
// This one isn't a native <select> like ProgramSelector/DashboardFilters -
// a pinned period needs an actual icon next to it (not a text emoji), and
// a native <option> can only ever render plain text, so there's no way to
// show an SVG inside one. Built as a small custom listbox instead, same
// button + absolute panel + click-outside-to-close pattern as UserMenu.
export default function PeriodSelector() {
  const {
    periods,
    activePeriod,
    isViewingAllPeriods,
    isViewingAllPrograms,
    switchPeriod,
    showArchivedPeriods,
    toggleShowArchivedPeriods,
    isLoading,
  } = useAcademic();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || isViewingAllPrograms) return null;

  const hasArchived = periods.some((p) => p.isArchived);
  const visiblePeriods = [...periods]
    .filter((p) => showArchivedPeriods || !p.isArchived)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  // Nothing worth picking yet (a program just created with no periods, or
  // a single non-archived period with nothing to compare against) - not
  // worth cluttering the top of the page with a one-option dropdown. If
  // there are archived periods hiding behind the toggle, still show the
  // toggle so they're reachable.
  if (visiblePeriods.length <= 1 && !hasArchived) return null;

  const currentLabel = isViewingAllPeriods
    ? 'View all periods'
    : (activePeriod?.name ?? 'Select period');

  const handleSelect = (id: string) => {
    switchPeriod(id);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {visiblePeriods.length > 1 && (
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            aria-label="Active period"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 w-auto min-w-[220px] border border-neutral-700 bg-neutral-900 text-white rounded-lg pl-3 pr-9 py-2.5 text-base text-left relative focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500"
          >
            {!isViewingAllPeriods && activePeriod?.isPinned && (
              <PinIcon className="text-violet-400 shrink-0" />
            )}
            <span className="truncate">{currentLabel}</span>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          </button>

          {isOpen && (
            <div
              role="listbox"
              className="absolute left-0 mt-1 w-full min-w-[220px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 z-50 max-h-72 overflow-y-auto"
            >
              {visiblePeriods.map((period: AcademicPeriod) => (
                <button
                  key={period.id}
                  type="button"
                  role="option"
                  aria-selected={!isViewingAllPeriods && activePeriod?.id === period.id}
                  onClick={() => handleSelect(period.id)}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${
                    period.isArchived ? 'text-neutral-500' : 'text-neutral-200'
                  }`}
                >
                  {period.isPinned && <PinIcon className="text-violet-400 shrink-0" />}
                  <span className="truncate">
                    {period.name}
                    {period.isArchived ? ' (archived)' : ''}
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="option"
                aria-selected={isViewingAllPeriods}
                onClick={() => handleSelect('all')}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors border-t border-neutral-800"
              >
                View all periods
              </button>
            </div>
          )}
        </div>
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
