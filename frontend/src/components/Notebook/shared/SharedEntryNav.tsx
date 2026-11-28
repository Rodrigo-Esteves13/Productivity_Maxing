import { Link } from 'react-router-dom';
import { useI18n } from '../../../i18n/useI18n';
import { friendPath, notebookEntryPath, socialTabPath } from '../../../lib/appLinks';
import Breadcrumbs from '../../UI/Breadcrumbs';
import PersonAvatar from '../../Social/PersonAvatar';
import type { SharedEntryContext } from '../../../types/models';

// Onde estas e para onde ir a seguir (so com sessao): o dono volta ao seu
// caderno; quem recebeu volta a "Partilhado comigo" e, se for amigo do dono,
// ve quem partilhou e vai a pagina dessa pessoa.
export default function SharedEntryNav({ title, context }: { title: string; context: SharedEntryContext | null }) {
  const { t } = useI18n();
  const ownEntryId = context?.ownEntryId ?? null;
  const owner = context?.owner ?? null;
  const ownerName = owner?.name?.trim() || t('social.anonymous');
  return (
    <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Breadcrumbs
        className="mb-0"
        items={
          ownEntryId
            ? [{ label: t('nav.notebook'), to: '/notebook' }, { label: title }]
            : [
                { label: t('nav.social'), to: socialTabPath('friends') },
                { label: t('nav.sharedWithMe'), to: socialTabPath('shared') },
                { label: title },
              ]
        }
      />
      {ownEntryId ? (
        <Link
          to={notebookEntryPath(ownEntryId, { share: true })}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-violet-700 hover:text-white"
        >
          {t('shared.nav.openInNotebook')}
        </Link>
      ) : owner ? (
        <Link
          to={friendPath(owner.userId)}
          className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 py-1 pl-1 pr-3 text-sm text-neutral-300 hover:border-violet-700 hover:text-white"
        >
          <PersonAvatar name={ownerName} avatarUrl={owner.avatarUrl} size="sm" />
          {t('shared.nav.sharedBy', { name: ownerName })}
        </Link>
      ) : null}
    </div>
  );
}
