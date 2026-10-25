import { useState } from 'react';
import { archivePeriod } from '../../api/academicService';
import { useAcademic } from '../../context/useAcademic';
import { getApiMessage, getHttpStatus } from '../../lib/httpError';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

// Never shows for the "View all" period (isViewingAllPeriods) nor for an
// already-archived period (see RestorePeriodButton for that case) - only
// makes sense for the actual active, non-archived period.
export default function ArchivePeriodButton() {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const { activePeriod, isViewingAllPeriods, refresh } = useAcademic();
  const [isArchiving, setIsArchiving] = useState(false);

  if (!activePeriod || isViewingAllPeriods || activePeriod.isArchived) return null;

  const handleArchive = async (forceConfirm = false) => {
    if (!forceConfirm) {
      const confirmed = await confirm({
        title: t('period.archive.title'),
        message: t('period.archive.message', { name: activePeriod.name }),
        confirmLabel: t('period.archive.confirm'),
      });
      if (!confirmed) return;
    }

    setIsArchiving(true);
    try {
      await archivePeriod(activePeriod.id, forceConfirm);
      // Era o periodo ativo: o refresh tem de passar para outro periodo ativo.
      await refresh({ leavePeriodId: activePeriod.id });
    } catch (err: unknown) {
      const status = getHttpStatus(err);
      if (status === 409) {
        // 409 = the backend refused because this is the program's most
        // recent period with no successor created yet - ask for explicit
        // extra confirmation before proceeding (see PeriodsService.archive
        // on the backend).
        const message = getApiMessage(
          err,
          t('period.archive.mostRecent'),
        );
        const confirmed = await confirm({
          title: t('period.archive.title'),
          message,
          confirmLabel: t('period.archive.anyway'),
        });
        if (confirmed) {
          await handleArchive(true);
          return;
        }
      } else if (status === 400) {
        // 400 = this is the user's only remaining active period anywhere -
        // hard block, no confirm can override it (see PeriodsService.archive).
        notify(
          getApiMessage(
            err,
            t('period.archive.onlyActive'),
          ),
          'error',
        );
      } else {
        notify(t('period.archive.error'), 'error');
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
      {isArchiving ? t('period.archive.busy') : t('period.archive.button')}
    </button>
  );
}
