import { Link } from 'react-router-dom';
import type { MyShare } from '../../api/socialHubService';
import { notebookEntryPath } from '../../lib/appLinks';
import { areaColorOf } from '../SharedWithMe/sharedWithMeLabels';
import { useI18n } from '../../i18n/useI18n';

// As tuas notas com link de partilha. Cada linha abre a nota no caderno com
// o painel de partilha aberto, onde se aprovam pedidos e se gere quem ve.
export default function MySharesList({ items }: { items: MyShare[] }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2">
      {items.map((share) => {
        const waiting = share.pendingRequests + share.pendingProposals;
        return (
          <li key={share.entryId}>
            <Link
              to={notebookEntryPath(share.entryId, { share: true })}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-violet-700"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{share.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: areaColorOf(share.areaColor) }}
                    />
                    {share.areaName}
                  </span>
                  <span>
                    {share.visibility === 'PUBLIC' ? t('social.mine.public') : t('social.mine.authorized')}
                  </span>
                  {share.visibility === 'AUTHORIZED' && (
                    <span>{t('social.mine.people', { count: share.peopleCount })}</span>
                  )}
                  {share.pendingInvites > 0 && (
                    <span>{t('social.mine.invites', { count: share.pendingInvites })}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {share.pendingRequests > 0 && (
                  <span className="rounded-full border border-amber-800 bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    {t('social.mine.requests', { count: share.pendingRequests })}
                  </span>
                )}
                {share.pendingProposals > 0 && (
                  <span className="rounded-full border border-violet-800 bg-violet-900/40 px-2 py-0.5 text-xs font-semibold text-violet-300">
                    {t('social.mine.proposals', { count: share.pendingProposals })}
                  </span>
                )}
                <span className="text-xs text-violet-400">
                  {waiting > 0 ? t('social.mine.review') : t('social.mine.manage')}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
