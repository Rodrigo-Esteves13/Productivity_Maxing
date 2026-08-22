interface SkeletonProps {
  className?: string;
}

// Base shimmering placeholder block. Deliberately just a styled <div>, not
// a new dependency - Tailwind's animate-pulse (already used all over,
// e.g. LoadingState.tsx, UserMenu.tsx) is all this needs.
export default function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-neutral-800/80 ${className}`} />;
}
