import { useI18n } from '../../../i18n/useI18n';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import type { ShareGateStatus } from '../../../hooks/useSharedNotebookEntry';
import { ShieldIcon } from '../../UI/Icons';

// One screen for all 4 non-'ok' outcomes of an AUTHORIZED share - the
// wording and the single available action are the only things that
// change between them. redirect is built from the CURRENT path (not
// hardcoded to /shared/:token) so this keeps working if the route ever
// changes shape.
export default function ShareAccessGate({
  status,
  token,
  hasSession,
  isRequesting,
  error,
  onRequestAccess,
  onInvitation,
}: {
  status: ShareGateStatus;
  token: string;
  hasSession: boolean;
  isRequesting: boolean;
  error: string;
  onRequestAccess: () => void;
  onInvitation: (accept: boolean) => void;
}) {
  const { t } = useI18n();
  const redirectPath = `/shared/${token}`;

  const copy: Record<ShareGateStatus, { title: string; body: string }> = {
    login_required: {
      title: t('ui.logInToViewThis'),
      body: t('ui.theOwnerOnlyAllowsPeople'),
    },
    not_requested: {
      title: t('ui.accessRequired'),
      body: t('ui.thisLessonIsOnlyVisible'),
    },
    pending: {
      title: t('ui.requestSent'),
      body: t('ui.yourRequestIsWaitingFor'),
    },
    invited: {
      title: t('share.gate.invited.title'),
      body: t('share.gate.invited.body'),
    },
    denied: {
      title: t('ui.requestDenied'),
      body: t('ui.theOwnerDidNotApprove'),
    },
  };

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldIcon className="h-8 w-8 text-neutral-700" />
      <h1 className="text-base font-semibold text-white">{copy[status].title}</h1>
      <p className="max-w-sm text-sm text-neutral-400">{copy[status].body}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {status === 'login_required' && (
        <a
          href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          {t('ui.logIn')}
        </a>
      )}

      {status === 'pending' && hasSession && <GateNotifyButton />}

      {status === 'invited' && hasSession && (
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => onInvitation(true)}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {t('sharedWithMe.invite.accept')}
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => onInvitation(false)}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {t('sharedWithMe.invite.decline')}
          </button>
        </div>
      )}

      {(status === 'not_requested' || status === 'denied') && hasSession && (
        <button
          type="button"
          disabled={isRequesting}
          onClick={onRequestAccess}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isRequesting ? t('auth.sending') : status === 'denied' ? t('ui.requestAgain') : t('ui.requestAccess')}
        </button>
      )}
    </div>
  );
}

// Pedido pendente: oferece ligar os avisos push neste dispositivo para o
// requerente saber logo que o dono decide (so aparece se ainda estao desligados).
function GateNotifyButton() {
  const { t } = useI18n();
  const { state, isBusy, enable } = usePushNotifications();
  if (state !== 'off') return null;
  return (
    <div className="mt-1 flex flex-col items-center gap-2">
      <p className="max-w-sm text-xs text-neutral-500">{t('share.gate.notifyMe')}</p>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void enable()}
        className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
      >
        {t('push.enable')}
      </button>
    </div>
  );
}
