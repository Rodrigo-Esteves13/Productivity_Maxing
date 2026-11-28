import { useI18n } from '../../../i18n/useI18n';
import type { UseEntryShareResult } from '../../../hooks/useEntryShare';
import type { ShareAccessRole } from '../../../types/models';
import ShareRequestRow from './ShareRequestRow';

interface ShareRequestListProps {
  share: UseEntryShareResult;
  pendingRoles: Record<string, ShareAccessRole>;
  onPendingRoleChange: (requestId: string, role: ShareAccessRole) => void;
}

export default function ShareRequestList({ share, pendingRoles, onPendingRoleChange }: ShareRequestListProps) {
  const { t } = useI18n();
  const { requests, pendingCount, isRequestsLoading, decidingId, decide, removeAccess } = share;

  return (
    <div className="mt-3 border-t border-neutral-800 pt-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-300">
        {t('share.requests.title')}
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-400">
            {t('share.pending', { count: pendingCount })}
          </span>
        )}
      </p>
      <p className="mb-2 text-[11px] text-neutral-500">{t('share.role.hint')}</p>
      {isRequestsLoading && <p className="text-xs text-neutral-500">{t('share.loading')}</p>}
      {!isRequestsLoading && requests.length === 0 && (
        <p className="text-xs text-neutral-500">{t('share.requests.empty')}</p>
      )}
      <ul className="space-y-1.5">
        {requests.map((req) => (
          <ShareRequestRow
            key={req.id}
            req={req}
            isDeciding={decidingId === req.id}
            pendingRole={pendingRoles[req.id] ?? 'VIEWER'}
            onPendingRoleChange={(role) => onPendingRoleChange(req.id, role)}
            decide={decide}
            removeAccess={removeAccess}
          />
        ))}
      </ul>
    </div>
  );
}
