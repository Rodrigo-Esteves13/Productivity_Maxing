import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { AlertTriangleIcon } from '../UI/Icons';
import { formatDuration } from '../../lib/timeFormat';
import { useI18n } from '../../i18n/useI18n';
import type { BurnoutResult } from '../../types/models';

interface BurnoutAlertCardProps {
  burnout: BurnoutResult | undefined;
}

// So aparece quando o backend ve humor/energia a cair com a carga mantida ou
// o stress a subir. Sem aviso (ou sem dados) nao ocupa espaco nenhum.
export default function BurnoutAlertCard({ burnout }: BurnoutAlertCardProps) {
  const { t } = useI18n();
  if (burnout?.kind !== 'warning') return null;

  return (
    <DashboardCard tone="danger" className="mb-6">
      <CardHeading tone="danger" className="mb-2">
        <AlertTriangleIcon className="shrink-0" />
        {t('wellbeing.burnout.title')}
      </CardHeading>
      <p className="mb-2 text-sm text-neutral-200">
        {t('wellbeing.burnout.mood', { recent: burnout.recentMood, before: burnout.baselineMood })}
      </p>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-neutral-300">
        {burnout.signals.map((signal) => (
          <li key={signal}>
            {t(`wellbeing.burnout.signal.${signal}`, {
              recent: formatDuration(burnout.recentStudyMinutesPerDay),
              before: formatDuration(burnout.baselineStudyMinutesPerDay),
            })}
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-400">{t('wellbeing.burnout.advice')}</p>
    </DashboardCard>
  );
}
