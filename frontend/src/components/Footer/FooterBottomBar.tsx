import { HeartIcon } from '../UI/Icons';
import StatusDot from '../UI/StatusDot';
import useHealthCheck from '../../hooks/useHealthCheck';

const STATUS_CONFIG = {
  checking: { color: 'amber' as const, pulse: false, label: 'Checking status...' },
  ok: { color: 'cyan' as const, pulse: true, label: 'All systems operational' },
  down: { color: 'red' as const, pulse: false, label: 'Backend unreachable' },
};

export default function FooterBottomBar() {
  const year = new Date().getFullYear();
  const health = useHealthCheck();
  const { color, pulse, label } = STATUS_CONFIG[health];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-neutral-800/80">
      <p className="text-xs text-neutral-500 order-2 sm:order-1">
        © {year} Productivity Maxing. All rights reserved.
      </p>

      <p className="flex items-center gap-1.5 text-xs text-neutral-500 order-1 sm:order-2">
        Built with <HeartIcon className="text-violet-500" /> and way too much coffee by Rodrigo
      </p>

      <div className="flex items-center gap-2 text-xs text-neutral-500 order-3">
        <StatusDot color={color} pulse={pulse} />
        <span>{label}</span>
      </div>
    </div>
  );
}
