import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicPerson } from '../../api/socialService';
import { useI18n } from '../../i18n/useI18n';
import PersonAvatar from './PersonAvatar';

interface Props {
  person: PublicPerson;
  subtitle?: ReactNode;
  /** Nome e foto passam a link (pagina do amigo). */
  to?: string;
  children?: ReactNode;
}

export default function PersonRow({ person, subtitle, to, children }: Props) {
  const { t } = useI18n();
  const name = person.name?.trim() || t('social.anonymous');
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      {to ? (
        <Link to={to} className="group flex min-w-0 items-center gap-3">
          <PersonAvatar name={name} avatarUrl={person.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white group-hover:text-violet-300">{name}</p>
            {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
          </div>
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={name} avatarUrl={person.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </li>
  );
}
