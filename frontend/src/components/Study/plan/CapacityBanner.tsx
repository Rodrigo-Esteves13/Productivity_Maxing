import { AlertTriangleIcon, CheckIcon } from '../../UI/Icons';
import type { StudyPlanResult } from '../../../types/models';
import { BANNER_BY_STATUS } from './planCopy';
import { formatDuration } from '../../../lib/timeFormat';
import { useI18n } from '../../../i18n/useI18n';

interface CapacityBannerProps {
  plan: StudyPlanResult;
}

const ICON_BY_STATUS = {
  no_work: CheckIcon,
  on_track: CheckIcon,
  overtime: AlertTriangleIcon,
  short: AlertTriangleIcon,
} as const;

export default function CapacityBanner({ plan }: CapacityBannerProps) {
  const { t } = useI18n();
  const { summary, dailyLimitMinutes } = plan;
  const copy = BANNER_BY_STATUS[summary.status];
  const Icon = ICON_BY_STATUS[summary.status];

  return (
    <div
      role="status"
      className={`rounded-lg border p-3 mb-4 ${copy.containerClass}`}
    >
      <p className={`flex items-center gap-2 text-sm font-semibold ${copy.titleClass}`}>
        <Icon className="shrink-0" />
        {copy.title}
      </p>
      <p className="text-xs text-neutral-400 mt-1">
        {copy.body({
          neededMinutes: summary.neededMinutes,
          overtimeMinutes: summary.overtimeMinutes,
          shortfallMinutes: summary.shortfallMinutes,
          dailyLimitMinutes,
        })}
      </p>
      <p className="text-xs text-neutral-500 mt-2">
        {t('ui.neededFitsWithoutOvertime', { neededMinutes: formatDuration(summary.neededMinutes), availableMinutes: formatDuration(summary.availableMinutes) })}</p>
    </div>
  );
}
