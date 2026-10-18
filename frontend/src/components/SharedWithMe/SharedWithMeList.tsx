import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SharedWithMeItem, SharedWithMeRole, SharedWithMeStatus } from '../../api/notebookService';
import { useI18n } from '../../i18n/useI18n';

const STATUS_STYLE: Record<SharedWithMeStatus, string> = {
  APPROVED: 'bg-cyan-900/50 text-cyan-300 border-cyan-800',
  PUBLIC: 'bg-sky-900/50 text-sky-300 border-sky-800',
  PENDING: 'bg-amber-900/50 text-amber-300 border-amber-800',
  DENIED: 'bg-red-900/50 text-red-300 border-red-800',
};

const ROLE_KEY: Record<SharedWithMeRole, string> = {
  VIEWER: 'sharedWithMe.role.viewer',
  EDITOR: 'sharedWithMe.role.editor',
  CO_OWNER: 'sharedWithMe.role.coOwner',
};

// Cor vem do servidor (colorHex da Area): so se aceita #rgb/#rrggbb, nunca
// texto livre dentro de um style.
const isHexColor = (value: string | null): value is string =>
  value !== null && /^#[0-9a-fA-F]{3,8}$/.test(value);

function InvitationCard({
  item,
  onRespond,
}: {
  item: SharedWithMeItem;
  onRespond: (requestId: string, accept: boolean) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async (accept: boolean) => {
    if (!item.requestId) return;
    setIsBusy(true);
    setFailed(false);
    const ok = await onRespond(item.requestId, accept);
    if (!ok) setFailed(true);
    setIsBusy(false);
  };

  return (
    <div className="rounded-xl border border-violet-800 bg-violet-950/20 p-4">
      <p className="truncate font-medium text-white">{item.title ?? t('sharedWithMe.hiddenTitle')}</p>
      <p className="mt-1 text-xs text-neutral-400">
        {t('sharedWithMe.invite.text', {
          name: item.ownerName ?? t('social.anonymous'),
          role: t(ROLE_KEY[item.role]),
        })}
      </p>
      {failed && <p className="mt-2 text-xs text-red-400">{t('sharedWithMe.invite.error')}</p>}
      <div className="mt-3 flex gap-2">
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

interface SharedWithMeListProps {
  items: SharedWithMeItem[];
  onRespond: (requestId: string, accept: boolean) => Promise<boolean>;
}

export default function SharedWithMeList({ items, onRespond }: SharedWithMeListProps) {
  const { t, lang } = useI18n();

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        if (item.invited) {
          return (
            <li key={item.token}>
              <InvitationCard item={item} onRespond={onRespond} />
            </li>
          );
        }
        const accessible = item.status === 'APPROVED' || item.status === 'PUBLIC';
        return (
          <li key={item.token}>
            <Link
              to={`/shared/${item.token}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-violet-700"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {accessible && item.title ? item.title : t('sharedWithMe.hiddenTitle')}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  {item.areaName && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: isHexColor(item.areaColor) ? item.areaColor : '#808080' }}
                      />
                      {item.areaName}
                    </span>
                  )}
                  {item.ownerName && <span>{t('sharedWithMe.by', { name: item.ownerName })}</span>}
                  <span>{new Date(item.lastActivityAt).toLocaleDateString(lang)}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}
                >
                  {t(`sharedWithMe.status.${item.status.toLowerCase()}`)}
                </span>
                {item.status === 'APPROVED' && (
                  <span className="text-xs text-neutral-400">{t(ROLE_KEY[item.role])}</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
