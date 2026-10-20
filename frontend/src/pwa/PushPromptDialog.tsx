import { useState } from 'react';
import { updateUserProfile } from '../api/userService';
import Button from '../components/UI/Button';
import { BellIcon } from '../components/UI/Icons';
import Modal from '../components/UI/Modal';
import ToggleRow from '../components/UI/ToggleRow';
import { useFeedback } from '../context/useFeedback';
import { usePushNotifications, type PushState } from '../hooks/usePushNotifications';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../types/models';
import { markPushPromptAnswered } from './pushPromptStorage';

// Estados em que o pedido nao serve para nada: ja ligadas, bloqueadas no
// browser (so a pessoa as desbloqueia nas definicoes), sem suporte ou sem
// chave VAPID no servidor.
const NOTHING_TO_ASK: ReadonlySet<PushState> = new Set(['loading', 'on', 'blocked', 'unsupported', 'unconfigured']);

export interface PushPromptDialogProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onDone: () => void;
}

// Carregado a parte (lazy) pelo PushPermissionPrompt, so para quem ainda
// nao respondeu: o resto das visitas nao descarrega este codigo.
export default function PushPromptDialog({ user, onUserUpdate, onDone }: PushPromptDialogProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const { state, isBusy, error, enable } = usePushNotifications();
  // Os lembretes de prazos por push sao uma preferencia a parte (desligada
  // por defeito); a pessoa decide aqui mesmo, com a caixa a vista.
  const [withDeadlines, setWithDeadlines] = useState(true);
  const needsDeadlineChoice = !user.deadlinePushReminders;

  // A resposta fica guardada logo no clique: mesmo que o pedido do browser
  // seja fechado ou falhe, a app nao volta a insistir.
  const close = () => {
    markPushPromptAnswered(user.id);
    onDone();
  };

  const handleEnable = async () => {
    markPushPromptAnswered(user.id);
    const result = await enable();
    // Falhou (ex: sem service worker): fica aberto a mostrar o erro.
    if (result === null) return;
    if (result === 'on') {
      if (needsDeadlineChoice && withDeadlines) {
        try {
          onUserUpdate(await updateUserProfile({ deadlinePushReminders: true }));
        } catch {
          notify(t('ui.couldNotSaveThePreference'), 'error');
        }
      }
      notify(t('push.enabled'), 'success');
    }
    onDone();
  };

  if (NOTHING_TO_ASK.has(state) && !error) return null;

  return (
    <Modal isOpen onClose={close} title={t('pushPrompt.title')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <BellIcon aria-hidden width={20} height={20} className="text-violet-300" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="text-neutral-200">{t('pushPrompt.body')}</p>
          <p className="mt-2 text-neutral-500">{t('pushPrompt.control')}</p>
        </div>
      </div>

      {needsDeadlineChoice && (
        <div className="mt-4">
          <ToggleRow
            variant="card"
            label={t('prefs.pushReminders')}
            description={t('pushPrompt.deadlinesHelp')}
            checked={withDeadlines}
            disabled={isBusy}
            onChange={setWithDeadlines}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error === 'noWorker' ? t('push.noWorker') : t('push.error')}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" className="px-4" onClick={close} disabled={isBusy}>
          {error ? t('common.close') : t('pushPrompt.later')}
        </Button>
        {!error && (
          <Button className="px-4" onClick={() => void handleEnable()} disabled={isBusy}>
            {isBusy ? t('pushPrompt.enabling') : t('push.enable')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
