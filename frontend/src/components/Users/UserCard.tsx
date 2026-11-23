import { Link } from 'react-router-dom';
import Avatar from '../Profile/Avatar';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import UserRowActions, { type UserRowHandlers } from './UserRowActions';
import { adminUserPath } from '../../lib/appLinks';
import type { User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface UserCardProps extends UserRowHandlers {
  user: User;
  isSelf: boolean;
  isReactivating: boolean;
}

// Vista mobile de um utilizador (a tabela so desliza na horizontal).
export default function UserCard({ user, isSelf, isReactivating, ...handlers }: UserCardProps) {
  const { t, lang } = useI18n();
  const initials = (user.name?.trim()?.[0] ?? user.email[0] ?? '?').toUpperCase();

  return (
    <li className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
      <Link to={adminUserPath(user.id)} className="group flex items-center gap-3">
        <Avatar initials={initials} avatarUrl={user.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="truncate font-medium text-neutral-200 group-hover:text-violet-300" title={user.name ?? undefined}>
            {user.name || <span className="text-neutral-500 italic">{t('ui.noName')}</span>}
            {isSelf && <span className="ml-2 text-xs text-violet-400">{t('ui.thatSYou')}</span>}
          </div>
          <div className="truncate text-xs text-neutral-400" title={user.email}>
            {user.email}
          </div>
        </div>
      </Link>
      {user.friendCode && (
        <p className="mt-1 font-mono text-xs text-neutral-500" title={t('adminSocial.code.title')}>
          {user.friendCode}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <RoleBadge role={user.role} />
        <UserStatusBadge status={user.status} suspendedUntil={user.suspendedUntil} />
        <span>
          {t('ui.joined')}: {new Date(user.createdAt).toLocaleDateString(lang)}
        </span>
      </div>
      <div className="mt-2 border-t border-neutral-800 pt-2">
        <UserRowActions user={user} isSelf={isSelf} isReactivating={isReactivating} {...handlers} />
      </div>
    </li>
  );
}
