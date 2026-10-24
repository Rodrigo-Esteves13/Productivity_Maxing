import { Link } from 'react-router-dom';
import Avatar from '../Profile/Avatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import { PencilIcon, TrashIcon, DownloadIcon, ClockIcon, ShieldIcon, CheckIcon, NetworkIcon } from '../UI/Icons';
import { adminUserPath } from '../../lib/appLinks';
import type { User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

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
              <IconButton
                label={isSelf ? t('ui.youCantSuspendYourOwn') : t('ui.suspendUser')}
                onClick={() => onSuspend(user)}
                disabled={isSelf}
                className="text-neutral-400 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ClockIcon className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={isSelf ? t('ui.youCantBanYourOwn') : t('ui.banUser')}
                onClick={() => onBan(user)}
                disabled={isSelf}
                className="text-neutral-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ShieldIcon className="h-4 w-4" />
              </IconButton>
            </>
          ) : (
            <IconButton
              label={t('ui.restoreToActive')}
              onClick={() => onReactivate(user)}
              disabled={isReactivating}
              className="text-neutral-400 hover:text-violet-400 disabled:opacity-30"
            >
              <CheckIcon className="h-4 w-4" />
            </IconButton>
          )}
          <Link
            to={adminUserPath(user.id)}
            title={t('adminSocial.open')}
            aria-label={t('adminSocial.open')}
            className="press rounded-md p-2 text-neutral-400 hover:bg-neutral-800/60 hover:text-violet-300"
          >
            <NetworkIcon className="h-4 w-4" />
          </Link>
          <IconButton
            label={t('ui.exportData')}
            onClick={() => onExport(user)}
            className="text-neutral-400 hover:text-white"
          >
            <DownloadIcon />
          </IconButton>
          <IconButton
            label={t('ui.editUser')}
            onClick={() => onEdit(user)}
            className="text-neutral-400 hover:text-white"
          >
            <PencilIcon />
          </IconButton>
          <IconButton
            label={isSelf ? t('ui.youCantDeleteYourOwn') : t('ui.deleteUser')}
            onClick={() => onDelete(user)}
            disabled={isSelf}
            className="text-neutral-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
          >
            <TrashIcon />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}
