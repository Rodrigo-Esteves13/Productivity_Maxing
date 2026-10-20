import Button from '../components/UI/Button';
import { DownloadIcon, ShareIcon } from '../components/UI/Icons';
import { useI18n } from '../i18n/useI18n';
import { useInstallApp } from './useInstallApp';

interface InstallAppCardProps {
  // Profile: aparece sempre que der para instalar, mesmo depois de "Agora nao"
  // no Dashboard, para a pessoa ter sempre onde voltar.
  alwaysShow?: boolean;
  className?: string;
}

// Convite para instalar a app. No Chrome/Edge/Android abre o dialogo do
// browser; no iPhone/iPad explica os passos do Safari, que e tambem o que
// faz as notificacoes push funcionarem ai.
export default function InstallAppCard({ alwaysShow = false, className = 'mb-6' }: InstallAppCardProps) {
  const { t } = useI18n();
  const { mode, isDismissed, dismiss, install } = useInstallApp();

  if (!mode || (isDismissed && !alwaysShow)) return null;

  return (
    <section className={`rounded-xl border border-violet-800/50 bg-neutral-900/50 p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <DownloadIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{t('install.title')}</h2>
          <p className="mt-1 text-sm text-neutral-400">{t('install.help')}</p>

          {mode === 'ios' && (
            <>
              <p className="mt-2 text-xs text-violet-200">{t('install.iosPush')}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-300">
                <li>
                  {t('install.iosStep1')}
                  <ShareIcon aria-hidden className="ml-1 inline h-4 w-4 align-text-bottom text-violet-300" />
                </li>
                <li>{t('install.iosStep2')}</li>
                <li>{t('install.iosStep3')}</li>
              </ol>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mode === 'prompt' && (
              <Button type="button" onClick={() => void install()} className="px-3 py-1.5 text-sm">
                {t('install.button')}
              </Button>
            )}
            {!alwaysShow && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                {t('install.notNow')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
