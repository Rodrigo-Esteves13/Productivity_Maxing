import Button from '../UI/Button';
import { usePushDeviceStatus } from '../../hooks/usePushDeviceStatus';
import { usePushNotifications, type PushState } from '../../hooks/usePushNotifications';
import { useI18n } from '../../i18n/useI18n';

// Estados deste browser em que o botao "Ligar aqui" pode resolver. 'on' com
// 0 dispositivos = o backend perdeu a linha; enable() volta a envia-la.
const CAN_ENABLE_HERE: ReadonlySet<PushState> = new Set(['off', 'on']);

// Explicacao extra conforme o estado deste browser.
const EXTRA_HINT: Partial<Record<PushState, string>> = {
  blocked: 'wellbeing.meds.push.blocked',
  unsupported: 'wellbeing.meds.push.unsupported',
};

// Os lembretes de medicacao so chegam por push. Sem nenhum dispositivo da
// conta com push (ou sem push no servidor) nunca chegava nada e o sino
// continuava a dizer "ligado". Mostra-se so quando ha lembretes ligados.
export default function MedicationPushWarning({ hasReminders }: { hasReminders: boolean }) {
  const { t } = useI18n();
  const { status, reload } = usePushDeviceStatus(hasReminders);
  const push = usePushNotifications();

  if (!hasReminders || !status) return null;
  if (status.configured && status.devices > 0) return null;

  const handleEnable = async () => {
    if ((await push.enable()) === 'on') await reload();
  };

  const extraKey = EXTRA_HINT[push.state];
  return (
    <div role="alert" className="mb-4 rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
      {!status.configured ? (
        <p>{t('wellbeing.meds.push.unconfigured')}</p>
      ) : (
        <>
          <p>{t('wellbeing.meds.push.noDevice')}</p>
          {extraKey && <p className="mt-1">{t(extraKey)}</p>}
          {CAN_ENABLE_HERE.has(push.state) && (
            <Button size="sm" variant="secondary" className="mt-2" disabled={push.isBusy} onClick={() => void handleEnable()}>
              {t('push.enable')}
            </Button>
          )}
          {push.error && <p className="mt-1">{t(push.error === 'noWorker' ? 'push.noWorker' : 'push.error')}</p>}
        </>
      )}
    </div>
  );
}
