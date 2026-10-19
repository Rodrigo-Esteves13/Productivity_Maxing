import { useI18n } from '../../i18n/useI18n';
export default function UsersTableHeader() {
  const { t } = useI18n();
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        <th className="px-4 py-3 font-medium">{t('ui.user')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.email')}</th>
        <th className="px-4 py-3 font-medium text-center">{t('ui.role')}</th>
        <th className="px-4 py-3 font-medium text-center">{t('ui.status')}</th>
        <th className="px-4 py-3 font-medium">{t('ui.joined')}</th>
        <th className="px-4 py-3 font-medium text-right">{t('ui.actions')}</th>
      </tr>
    </thead>
  );
}
