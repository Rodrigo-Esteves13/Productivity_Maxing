import { useState } from 'react';
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from '../../../lib/focusAlerts';
import { useI18n } from '../../../i18n/useI18n';

// Sem permissao, o fim do bloco e da pausa so se ve na propria tab. Diz isso
// a pessoa antes de comecar, com o botao para ativar (ou como desbloquear).
export default function NotifyPermissionHint() {
  const { t } = useI18n();
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission);

  if (permission === 'unsupported') return null;

  // Os avisos dependem de JS a correr na pagina (nao ha push do servidor no
  // fim do bloco): com o ecra do telemovel bloqueado so chegam ao voltar.
  if (permission === 'granted') {
    return <p className="mt-1.5 text-[11px] text-neutral-500">{t('focus.notify.needsAppOpen')}</p>;
  }

  if (permission === 'denied') {
    return <p className="mt-1.5 text-[11px] text-amber-400">{t('focus.notify.blocked')}</p>;
  }

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-amber-300">
      <span>{t('focus.notify.hint')}</span>
      <button
        type="button"
        onClick={() => void requestNotifyPermission().then(setPermission)}
        className="font-medium text-violet-400 hover:text-violet-300 hover:underline"
      >
        {t('focus.notify.allow')}
      </button>
    </p>
  );
}
