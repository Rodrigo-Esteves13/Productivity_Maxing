import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useI18n } from '../../i18n/useI18n';

export default function PushNotificationsCard() {
  const { t } = useI18n();
  const { state, isBusy, error, enable, disable } = usePushNotifications();

  const message =
    state === 'unsupported'
      ? t('push.unsupported')
      : state === 'blocked'
        ? t('push.blocked')
        : state === 'unconfigured'
          ? t('push.notConfigured')
          : state === 'on'
            ? t('push.enabled')
            : null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white">{t('push.title')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t('push.help')}</p>
      {message && <p className="mt-3 text-sm text-neutral-300">{message}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {t('push.error')}
        </p>
      )}
      {(state === 'off' || state === 'on') && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void (state === 'on' ? disable() : enable())}
          className="mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {state === 'on' ? t('push.disable') : t('push.enable')}
        </button>
      )}
    </div>
  );
}
