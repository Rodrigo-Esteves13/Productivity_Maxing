import Skeleton from './Skeleton';

interface FormSkeletonProps {
  sections?: number;
  className?: string;
}

// Mimics a page built out of stacked card-sections with a few label+field
// pairs each - Profile's ProfileHeaderCard/GoogleCalendarCard/
// AccessibilitySettingsCard stack, and Agent's config sections. Each
// "section" is one bordered block; fieldsPerSection stays fixed at 3
// since none of these pages' skeletons need to be pixel-exact, just
// clearly "a form is loading" rather than a blank page.
export default function FormSkeleton({ sections = 3, className = '' }: FormSkeletonProps) {
  return (
    <div aria-hidden="true" aria-busy="true" className={`space-y-6 ${className}`}>
      {Array.from({ length: sections }).map((_, i) => (
        <div
          key={i}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 space-y-4"
        >
          <Skeleton className="h-5 w-1/3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
