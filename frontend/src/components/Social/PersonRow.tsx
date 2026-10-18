import type { ReactNode } from 'react';
import type { PublicPerson } from '../../api/socialService';
import { useI18n } from '../../i18n/useI18n';

interface Props {
  person: PublicPerson;
  subtitle?: string;
  children?: ReactNode;
}

export default function PersonRow({ person, subtitle, children }: Props) {
  const { t } = useI18n();
  const name = person.name?.trim() || t('social.anonymous');
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex min-w-0 items-center gap-3">
        {person.avatarUrl ? (
          <img
            src={person.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-sm font-medium text-neutral-300"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </li>
  );
}
