import { ClockIcon } from '../UI/Icons';

interface MaintenancePageProps {
  message?: string;
}

export default function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-center px-4">
      <div className="max-w-md">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
          <ClockIcon width={28} height={28} />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Down for maintenance</h1>
        <p className="text-neutral-400 mb-6">
          {message ?? "We're doing some quick upkeep. This shouldn't take long - check back in a few minutes."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
