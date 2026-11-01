import { EyeIcon, EyeOffIcon } from '../UI/Icons';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

// Botao do cabecalho de Money: esconde os valores no ecra. A nota explica que
// so esconde o que se ve (nao protege os dados).
export default function FinancePrivacyToggle() {
  const { t } = useI18n();
  const { enabled, toggle } = usePrivacyMode();
  const Icon = enabled ? EyeOffIcon : EyeIcon;
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <Icon className="h-4 w-4" />
        {enabled ? t('finance.privacy.show') : t('finance.privacy.hide')}
      </button>
      <p className="mt-1 text-xs text-neutral-500">{t('finance.privacy.note')}</p>
    </div>
  );
}
