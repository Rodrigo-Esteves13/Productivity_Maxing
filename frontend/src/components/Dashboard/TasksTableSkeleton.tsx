import Skeleton from '../UI/Skeleton';

const SKELETON_ROW_COUNT = 6;

// Shown in place of DashboardFilters + TasksTable while Dashboard.tsx's
// initial fetch is in flight. Same outer frame the real table uses
// (bg-neutral-900/50 border border-neutral-800 rounded-xl) so there's no
// layout jump when the real content swaps in - this is the "Facebook-style"
// placeholder Rodrigo asked for, replacing the single centered spinner that
// used to sit here (LoadingState) and made the whole page look frozen.
export default function TasksTableSkeleton() {
  return (
    <div aria-hidden="true" aria-busy="true">
      {/* Filters bar shape */}
      <div className="print-hide mb-4 flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Table shape */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-4 flex-[2]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4 border-b border-neutral-800/60 last:border-b-0"
          >
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-4 flex-[2]" />
            <Skeleton className="hidden sm:block h-4 flex-1" />
            <Skeleton className="hidden sm:block h-4 flex-1" />
            <Skeleton className="hidden sm:block h-4 flex-1" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
