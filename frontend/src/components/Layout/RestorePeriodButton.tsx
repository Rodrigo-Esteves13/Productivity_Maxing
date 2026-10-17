import { useState } from 'react';
import { useAcademic } from '../../context/useAcademic';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

// Counterpart to ArchivePeriodButton - only shows when the active period
// IS archived. No confirmation needed and no restrictions on the backend:
// restoring a period only ever adds an active dashboard back, never
// removes one.
export default function RestorePeriodButton() {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const { activePeriod, isViewingAllPeriods, restorePeriod } = useAcademic();
  const [isRestoring, setIsRestoring] = useState(false);

  if (!activePeriod || isViewingAllPeriods || !activePeriod.isArchived) return null;

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePeriod(activePeriod.id);
    } catch {
      notify(t('period.restore.error'), 'error');
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
      {isRestoring ? t('period.restore.busy') : t('period.restore.button')}
    </button>
  );
}
