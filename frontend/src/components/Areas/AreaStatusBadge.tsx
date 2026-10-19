import type { Area } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

// Etiqueta curta: Official / Personal / Under review / Not approved.
export default function AreaStatusBadge({ area }: { area: Area }) {
  const { t } = useI18n();
  let label = t('ui.areaOfficial');
  let cls = 'border-neutral-700 text-neutral-400';
  if (!area.isOfficial) {
    if (area.proposalStatus === 'PENDING') {
      label = t('ui.areaUnderReview');
      cls = 'border-amber-500/40 text-amber-400';
    } else if (area.proposalStatus === 'REJECTED') {
      label = t('ui.areaNotApproved');
      cls = 'border-red-500/40 text-red-400';
    } else {
      label = t('ui.areaPersonal');
      cls = 'border-violet-500/40 text-violet-300';
    }
  }
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
