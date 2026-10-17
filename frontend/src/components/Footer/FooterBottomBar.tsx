import { HeartIcon } from '../UI/Icons';
import StatusDot from '../UI/StatusDot';
import useHealthCheck from '../../hooks/useHealthCheck';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

const STATUS_CONFIG = {
  checking: { color: 'amber' as const, pulse: false, label: 'footer.status.checking' },
  ok: { color: 'cyan' as const, pulse: true, label: 'footer.status.ok' },
  down: { color: 'red' as const, pulse: false, label: 'footer.status.down' },
};

export default function FooterBottomBar() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const health = useHealthCheck();
  const { color, pulse, label } = STATUS_CONFIG[health];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-neutral-800/80">
      <p className="text-xs text-neutral-500 order-2 sm:order-1">
        {t('footer.rights', { year })}
      </p>

      <p className="flex items-center gap-1.5 text-xs text-neutral-500 order-1 sm:order-2">
        {fillNodes(t('footer.madeBy'), { heart: <HeartIcon className="text-violet-500" /> })}
      </p>

      <div className="flex items-center gap-2 text-xs text-neutral-500 order-3">
        <StatusDot color={color} pulse={pulse} />
        <span>{t(label)}</span>
      </div>
    </div>
  );
}
