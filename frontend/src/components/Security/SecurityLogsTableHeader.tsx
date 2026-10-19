import { useI18n } from '../../i18n/useI18n';
export default function SecurityLogsTableHeader() {
  const { t } = useI18n();
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        <th className="px-4 py-3 font-medium">{t('ui.when')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.ip')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.method')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.path')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.user')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.userAgent')}</th>
      </tr>
    </thead>
  );
}
