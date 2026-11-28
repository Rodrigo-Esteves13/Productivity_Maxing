import { useI18n } from '../../../i18n/useI18n';

export default function SectionCount({ count }: { count: number }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-800 px-1.5 text-[11px] font-medium tabular-nums text-neutral-300">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{t('areas.section.count', { count })}</span>
    </span>
  );
}
