import Avatar from '../Profile/Avatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import { PencilIcon, TrashIcon, DownloadIcon, ClockIcon, ShieldIcon, CheckIcon } from '../UI/Icons';
import type { User } from '../../types/models';

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
  const initials = (user.name?.trim()?.[0] ?? user.email[0] ?? '?').toUpperCase();
  const status = user.status ?? 'ACTIVE';

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} avatarUrl={user.avatarUrl} size="sm" />
          <div>
            <div className="font-medium text-neutral-200">
              {user.name || <span className="text-neutral-500 italic">No name</span>}
            </div>
            {isSelf && <div className="text-xs text-violet-400">That's you</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-400">{user.email}</td>
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
                title={isSelf ? "You can't suspend your own account" : 'Suspend user'}
                disabled={isSelf}
                className="text-neutral-400 hover:text-amber-400 transition-colors p-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ClockIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => onBan(user)}
                title={isSelf ? "You can't ban your own account" : 'Ban user'}
                disabled={isSelf}
                className="text-neutral-400 hover:text-red-500 transition-colors p-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <ShieldIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onReactivate(user)}
              title="Restore to active"
              disabled={isReactivating}
              className="text-neutral-400 hover:text-emerald-400 transition-colors p-1.5 disabled:opacity-30"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onExport(user)}
            title="Export data"
            className="text-neutral-400 hover:text-white transition-colors p-1.5"
          >
            <DownloadIcon />
          </button>
          <button
            onClick={() => onEdit(user)}
            title="Edit user"
            className="text-neutral-400 hover:text-white transition-colors p-1.5"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onDelete(user)}
            title={isSelf ? "You can't delete your own account here" : 'Delete user'}
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
