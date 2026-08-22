import Skeleton from './Skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

// Same frame every real table on this app uses
// (bg-neutral-900/50 border border-neutral-800 rounded-xl) - see
// TasksTableSkeleton.tsx, which this generalizes. That one stays
// Dashboard-specific (it also mimics DashboardFilters above the table);
// this one is the plain "just a table" shape for every admin/list page
// that doesn't have a filters bar of its own: ApiKeysTable (Developer),
// UsersTable, SecurityLogsTable, TaskTypesTable/AcademicTaskTypesTable.
export default function TableSkeleton({ rows = 5, columns = 4, className = '' }: TableSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className={`bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl ${className}`}
    >
      <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? 'flex-[2]' : 'flex-1'}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 px-4 py-4 border-b border-neutral-800/60 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={`h-4 ${colIndex === 0 ? 'flex-[2]' : 'hidden sm:block flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
