import { useState } from 'react';
import { sendTestPush } from '../../api/pushService';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useI18n } from '../../i18n/useI18n';

export default function PushNotificationsCard() {
  const { t } = useI18n();
  const { state, isBusy, error, enable, disable } = usePushNotifications();
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const result = await sendTestPush();
      setTestMessage(
        !result.configured
          ? t('push.notConfigured')
          : result.devices === 0
            ? t('push.testNone')
            : t('push.testOk', { delivered: result.delivered, devices: result.devices }),
      );
    } catch {
      setTestMessage(t('push.testFailed'));
    } finally {
      setIsTesting(false);
    }
  };

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
      <p className="mt-2 text-xs text-neutral-500">{t('push.eachDevice')}</p>
      {message && <p className="mt-3 text-sm text-neutral-300">{message}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error === 'noWorker' ? t('push.noWorker') : t('push.error')}
        </p>
      )}
      {(state === 'off' || state === 'on') && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void (state === 'on' ? disable() : enable())}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {state === 'on' ? t('push.disable') : t('push.enable')}
          </button>
          {state === 'on' && (
            <button
              type="button"
              disabled={isTesting}
              onClick={() => void handleTest()}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            >
              {t('push.test')}
            </button>
          )}
        </div>
      )}
      {testMessage && <p className="mt-3 text-sm text-neutral-300">{testMessage}</p>}
    </div>
  );
}
