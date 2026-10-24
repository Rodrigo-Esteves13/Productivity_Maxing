import { useI18n } from '../../i18n/useI18n';

interface ActiveBadgeProps {
  isActive: boolean;
}

export default function ActiveBadge({ isActive }: ActiveBadgeProps) {
  const { t } = useI18n();
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full border ${
        isActive
          ? 'bg-violet-900/50 text-violet-400 border-violet-800'
          : 'bg-neutral-800 text-neutral-500 border-neutral-700'
      }`}
    >
      {isActive ? t('ui.activeBadge') : t('ui.inactiveBadge')}
    </span>
  );
}
