import Skeleton from './Skeleton';

interface CardGridSkeletonProps {
  cards?: number;
  className?: string;
}

// Mimics AreaGrid/TaskGrid's shape: a responsive grid of card tiles, each
// with a title line, a couple of secondary lines, and a small badge/icon
// corner. Not pixel-identical to either grid (they differ slightly from
// each other too), close enough that there's no layout jump worth
// avoiding - the point is signaling "cards are coming", not tricking
// anyone into thinking real content already loaded.
export default function CardGridSkeleton({ cards = 6, className = '' }: CardGridSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
