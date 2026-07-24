import { useState } from 'react';
import { useAcademic } from '../../context/useAcademic';

// Counterpart to ArchivePeriodButton - only shows when the active period
// IS archived. No confirmation needed and no restrictions on the backend:
// restoring a period only ever adds an active dashboard back, never
// removes one.
export default function RestorePeriodButton() {
  const { activePeriod, isViewingAllPeriods, restorePeriod } = useAcademic();
  const [isRestoring, setIsRestoring] = useState(false);

  if (!activePeriod || isViewingAllPeriods || !activePeriod.isArchived) return null;

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePeriod(activePeriod.id);
    } catch {
      alert('Could not restore the period. Try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isRestoring}
      className="text-sm text-violet-400 hover:text-violet-300 underline decoration-dotted disabled:opacity-50"
    >
      {isRestoring ? 'Restoring...' : 'Restore period'}
    </button>
  );
}
