import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SharedWithMeItem, SharedWithMeRole } from '../../api/notebookService';
import type { InvitationAnswer } from '../../hooks/useSharedWithMe';
import { useI18n } from '../../i18n/useI18n';
import { ROLE_KEY, areaColorOf } from './sharedWithMeLabels';
import { sharedNotePath } from '../../lib/appLinks';

// O que o papel deixa fazer, dito antes de aceitar.
const ROLE_HINT_KEY: Record<SharedWithMeRole, string> = {
  VIEWER: 'sharedWithMe.invite.roleHint.viewer',
  EDITOR: 'sharedWithMe.invite.roleHint.editor',
  CO_OWNER: 'sharedWithMe.invite.roleHint.coOwner',
};

interface InvitationCardProps {
  item: SharedWithMeItem;
  onRespond: (requestId: string, accept: boolean) => Promise<InvitationAnswer>;
}

// Convite de um amigo para UMA nota. Aceitar abre logo a nota (um editor
// comeca a sugerir alteracoes ali mesmo); recusar so tira o cartao.
export default function InvitationCard({ item, onRespond }: InvitationCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async (accept: boolean) => {
    if (!item.requestId) return;
    setIsBusy(true);
    setFailed(false);
    const result = await onRespond(item.requestId, accept);
    setIsBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    if (accept && result.token) navigate(sharedNotePath(result.token));
  };

  return (
    <div className="rounded-xl border border-violet-800 bg-violet-950/20 p-4">
      <p className="truncate font-medium text-white">{item.title ?? t('sharedWithMe.hiddenTitle')}</p>
      {item.areaName && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: areaColorOf(item.areaColor) }}
          />
          <span className="truncate">{item.areaName}</span>
        </p>
      )}
      <p className="mt-2 text-xs text-neutral-300">
        {t('sharedWithMe.invite.text', {
          name: item.ownerName ?? t('social.anonymous'),
          role: t(ROLE_KEY[item.role]),
        })}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">{t(ROLE_HINT_KEY[item.role])}</p>
      {failed && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {t('sharedWithMe.invite.error')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void answer(true)}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {t('sharedWithMe.invite.accept')}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void answer(false)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          {t('sharedWithMe.invite.decline')}
        </button>
      </div>
    </div>
  );
}
