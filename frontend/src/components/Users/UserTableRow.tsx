import { Link } from 'react-router-dom';
import Avatar from '../Profile/Avatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import { PencilIcon, TrashIcon, DownloadIcon, ClockIcon, ShieldIcon, CheckIcon, NetworkIcon } from '../UI/Icons';
import { adminUserPath } from '../../lib/appLinks';
import type { User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface UserTableRowProps {
  user: User;
  isSelf: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onExport: (user: User) => void;
  onSuspend: (user: User) => void;
  onBan: (user: User) => void;
  onReactivate: (user: User) => void;
  isReactivating: boolean;
}

export default function UserTableRow({
  user,
  isSelf,
  onEdit,
  onDelete,
  onExport,
  onSuspend,
  onBan,
  onReactivate,
  isReactivating,
}: UserTableRowProps) {
  const { t } = useI18n();
  const initials = (user.name?.trim()?.[0] ?? user.email[0] ?? '?').toUpperCase();
  const status = user.status ?? 'ACTIVE';

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">
        {/* Nome abre o perfil (codigo de amigo e ligacoes). */}
        <Link to={adminUserPath(user.id)} className="group flex items-center gap-3">
          <Avatar initials={initials} avatarUrl={user.avatarUrl} size="sm" />
          <div>
            <div className="font-medium text-neutral-200 group-hover:text-violet-300">
              {user.name || <span className="text-neutral-500 italic">{t('ui.noName')}</span>}
            </div>
            {isSelf && <div className="text-xs text-violet-400">{t('ui.thatSYou')}</div>}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-neutral-400">
        {user.email}
        {user.friendCode && (
          <div className="font-mono text-xs text-neutral-500" title={t('adminSocial.code.title')}>
            {user.friendCode}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-center">
        <UserStatusBadge status={user.status} suspendedUntil={user.suspendedUntil} />
      </td>
      <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {status === 'ACTIVE' ? (
            <>
              <button
                onClick={() => onSuspend(user)}
                title={isSelf ? t('ui.youCantSuspendYourOwn') : t('ui.suspendUser')}
                disabled={isSelf}
                className="text-neutral-400 hover:text-amber-400 transition-colors p-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ClockIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => onBan(user)}
                title={isSelf ? t('ui.youCantBanYourOwn') : t('ui.banUser')}
                disabled={isSelf}
                className="text-neutral-400 hover:text-red-500 transition-colors p-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ShieldIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onReactivate(user)}
              title={t('ui.restoreToActive')}
              disabled={isReactivating}
              className="text-neutral-400 hover:text-emerald-400 transition-colors p-1.5 disabled:opacity-30"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          )}
          <Link
            to={adminUserPath(user.id)}
            title={t('adminSocial.open')}
            aria-label={t('adminSocial.open')}
            className="text-neutral-400 hover:text-violet-300 transition-colors p-1.5"
          >
            <NetworkIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={() => onExport(user)}
            title={t('ui.exportData')}
            className="text-neutral-400 hover:text-white transition-colors p-1.5"
          >
            <DownloadIcon />
          </button>
          <button
            onClick={() => onEdit(user)}
            title={t('ui.editUser')}
            className="text-neutral-400 hover:text-white transition-colors p-1.5"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onDelete(user)}
            title={isSelf ? t('ui.youCantDeleteYourOwn') : t('ui.deleteUser')}
            disabled={isSelf}
            className="text-neutral-400 hover:text-red-500 transition-colors p-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}
