import { Link } from 'react-router-dom';
import Avatar from '../Profile/Avatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import UserRowActions, { type UserRowHandlers } from './UserRowActions';
import { adminUserPath } from '../../lib/appLinks';
import type { User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface UserTableRowProps extends UserRowHandlers {
  user: User;
  isSelf: boolean;
  isReactivating: boolean;
}

export default function UserTableRow({ user, isSelf, isReactivating, ...handlers }: UserTableRowProps) {
  const { t, lang } = useI18n();
  const initials = (user.name?.trim()?.[0] ?? user.email[0] ?? '?').toUpperCase();

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
      <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString(lang)}</td>
      <td className="px-4 py-3">
        <UserRowActions user={user} isSelf={isSelf} isReactivating={isReactivating} {...handlers} />
      </td>
    </tr>
  );
}
