import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PersonAvatar from '../Social/PersonAvatar';
import UserStatusBadge from './UserStatusBadge';
import type { AdminPerson } from '../../api/adminSocialService';
import { adminUserPath } from '../../lib/appLinks';
import { useI18n } from '../../i18n/useI18n';

interface Props<P extends AdminPerson> {
  /** Sem titulo quando a secao ja o diz. */
  title?: string;
  people: P[];
  empty: string;
  /** Linha por baixo do email (data, cadeiras, notas...). */
  detail?: (person: P) => ReactNode;
}

// Lista de pessoas ligadas a uma conta, vista pelo admin. Cada pessoa abre o
// perfil dela: assim navega-se pela rede de amizades de perfil em perfil.
export default function AdminPersonList<P extends AdminPerson>({ title, people, empty, detail }: Props<P>) {
  const { t } = useI18n();
  return (
    <div>
      {title && (
        <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {title}
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
            {people.length}
          </span>
        </h3>
      )}
      {people.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {people.map((person) => {
            const name = person.name?.trim() || t('social.anonymous');
            return (
              <li key={person.userId}>
                <Link
                  to={adminUserPath(person.userId)}
                  className="group flex min-w-0 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5 transition-colors hover:border-violet-800 hover:bg-neutral-900"
                >
                  <PersonAvatar name={name} avatarUrl={person.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white group-hover:text-violet-300">{name}</p>
                    <p className="truncate text-xs text-neutral-500">{person.email}</p>
                    {detail && <div className="mt-0.5 text-xs text-neutral-400">{detail(person)}</div>}
                  </div>
                  {person.status !== 'ACTIVE' && <UserStatusBadge status={person.status} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
