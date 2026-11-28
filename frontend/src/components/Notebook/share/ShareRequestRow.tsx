import { Link } from 'react-router-dom';
import { CheckIcon, XIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import { friendPath } from '../../../lib/appLinks';
import type { UseEntryShareResult } from '../../../hooks/useEntryShare';
import type { ShareAccessRole } from '../../../types/models';
import RoleSelect from './RoleSelect';
import { ROLE_KEY } from './shareRoles';

interface ShareRequestRowProps {
  req: UseEntryShareResult['requests'][number];
  isDeciding: boolean;
  // Papel escolhido para um pedido pendente, antes de aprovar.
  pendingRole: ShareAccessRole;
  onPendingRoleChange: (role: ShareAccessRole) => void;
  decide: UseEntryShareResult['decide'];
  removeAccess: UseEntryShareResult['removeAccess'];
}

// Uma pessoa com pedido, convite ou acesso.
export default function ShareRequestRow({
  req,
  isDeciding,
  pendingRole,
  onPendingRoleChange,
  decide,
  removeAccess,
}: ShareRequestRowProps) {
  const { t } = useI18n();

  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <div className="min-w-0">
        {/* Convidados sao amigos: o nome leva a pagina dessa pessoa. */}
        {req.invitedByOwner ? (
          <Link
            to={friendPath(req.requestingUser.id)}
            className="block truncate text-neutral-200 hover:text-violet-300 hover:underline"
            title={req.requestingUser.name ?? t('social.anonymous')}
          >
            {req.requestingUser.name ?? t('social.anonymous')}
          </Link>
        ) : (
          <p
            className="truncate text-neutral-200"
            title={req.requestingUser.name ?? (req.requestingUser.email || t('social.anonymous'))}
          >
            {req.requestingUser.name ?? (req.requestingUser.email || t('social.anonymous'))}
          </p>
        )}
        {req.requestingUser.email && (
          <p className="truncate text-neutral-500" title={req.requestingUser.email}>{req.requestingUser.email}</p>
        )}
      </div>
      {req.status === 'PENDING' && req.invitedByOwner ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-neutral-500">
            {t('share.invite.invited')} · {t(ROLE_KEY[req.accessRole])}
          </span>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => void removeAccess(req.id)}
            aria-label={t('share.invite.cancel')}
            title={t('share.invite.cancel')}
            className="rounded-md bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : req.status === 'PENDING' ? (
        <div className="flex shrink-0 items-center gap-1">
          <RoleSelect
            value={pendingRole}
            disabled={isDeciding}
            onChange={onPendingRoleChange}
          />
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => void decide(req.id, 'APPROVED', pendingRole)}
            aria-label={t('share.approve')}
            title={t('share.approve')}
            className="rounded-md bg-violet-500/15 p-1 text-violet-400 hover:bg-violet-500/25 disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => void decide(req.id, 'DENIED')}
            aria-label={t('share.deny')}
            title={t('share.deny')}
            className="rounded-md bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : req.status === 'APPROVED' ? (
        <div className="flex shrink-0 items-center gap-1">
          <RoleSelect
            value={req.accessRole}
            disabled={isDeciding}
            onChange={(role) => void decide(req.id, 'APPROVED', role)}
          />
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => void removeAccess(req.id)}
            aria-label={t('share.invite.remove')}
            title={t('share.invite.remove')}
            className="rounded-md bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
          <XIcon className="h-3 w-3" />
          {t('share.denied')}
        </span>
      )}
    </li>
  );
}
