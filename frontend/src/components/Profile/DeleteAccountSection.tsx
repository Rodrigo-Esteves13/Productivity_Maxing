import { useI18n } from '../../i18n/useI18n';
interface DeleteAccountSectionProps {
  onOpen: () => void;
}

export default function DeleteAccountSection({ onOpen }: DeleteAccountSectionProps) {
  const { t } = useI18n();
  return (
    <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 sm:p-6 mt-4">
      <h3 className="text-red-400 font-semibold mb-1">{t('ui.dangerZone')}</h3>
      <p className="text-neutral-400 text-sm mb-4">
        {t('ui.deletingYourAccountIsPermanent')}
      </p>
      <button
        onClick={onOpen}
        className="px-4 py-2 rounded-lg border border-red-900/60 text-red-400 text-sm font-medium hover:bg-red-950/40 transition-colors"
      >
        {t('ui.deleteAccount')}
      </button>
    </div>
  );
}
