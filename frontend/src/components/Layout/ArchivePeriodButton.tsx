import { useState } from 'react';
import { archivePeriod } from '../../api/academicService';
import { useAcademic } from '../../context/useAcademic';

// Never shows for the "View all" period (isViewingAllPeriods) nor for an
// already-archived period (see RestorePeriodButton for that case) - only
// makes sense for the actual active, non-archived period.
export default function ArchivePeriodButton() {
  const { activePeriod, isViewingAllPeriods, refresh } = useAcademic();
  const [isArchiving, setIsArchiving] = useState(false);

  if (!activePeriod || isViewingAllPeriods || activePeriod.isArchived) return null;

  const handleArchive = async (forceConfirm = false) => {
    if (
      !forceConfirm &&
      !window.confirm(`Archive "${activePeriod.name}"? It gets hidden from the selector - you can bring it back anytime with "Show archived" + Restore.`)
    ) {
      return;
    }

    setIsArchiving(true);
    try {
      await archivePeriod(activePeriod.id, forceConfirm);
      await refresh();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        // 409 = the backend refused because this is the program's most
        // recent period with no successor created yet - ask for explicit
        // extra confirmation before proceeding (see PeriodsService.archive
        // on the backend).
        const message =
          err.response?.data?.message ??
          'This is the most recent period in this program, with no successor. Archive it anyway?';
        if (window.confirm(message)) {
          await handleArchive(true);
          return;
        }
      } else if (status === 400) {
        // 400 = this is the user's only remaining active period anywhere -
        // hard block, no confirm can override it (see PeriodsService.archive).
        alert(
          err.response?.data?.message ??
            "This is your only active period. Create another one before archiving this one.",
        );
      } else {
        alert('Could not archive the period. Try again.');
      }
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => handleArchive(false)}
      disabled={isArchiving}
      className="text-sm text-neutral-400 hover:text-neutral-200 underline decoration-dotted disabled:opacity-50"
    >
      {isArchiving ? 'Archiving...' : 'Archive period'}
    </button>
  );
}
