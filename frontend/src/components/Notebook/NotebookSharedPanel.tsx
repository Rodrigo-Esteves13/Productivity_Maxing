import { Link } from 'react-router-dom';
import InvitationCard from '../SharedWithMe/InvitationCard';
import { ROLE_KEY, areaColorOf } from '../SharedWithMe/sharedWithMeLabels';
import { useSharedWithMe } from '../../hooks/useSharedWithMe';
import { useI18n } from '../../i18n/useI18n';
import { sharedNotePath, socialTabPath } from '../../lib/appLinks';

// Na pagina de Notas o refresh pode ser mais lento que no Social.
const POLL_MS = 60000;
// So os mais recentes: a lista completa vive em Social > Shared with me.
const MAX_SHARED_LINKS = 6;

// Notas de amigos dentro do caderno: convites a espera de resposta (aceitar
// abre a nota) e atalhos para as notas a que ja tens acesso. Sem nada para
// mostrar, nao ocupa espaco.
export default function NotebookSharedPanel() {
  const { t } = useI18n();
  const { items, respond } = useSharedWithMe({ intervalMs: POLL_MS });
  const invitations = items.filter((item) => item.invited);
  const accessible = items
    .filter((item) => !item.invited && item.status === 'APPROVED' && item.title)
    .slice(0, MAX_SHARED_LINKS);

  if (invitations.length === 0 && accessible.length === 0) return null;

  return (
    <section
      aria-label={t('notebook.shared.title')}
      className="mb-6 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{t('notebook.shared.title')}</h2>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <Link to={socialTabPath('shared')} className="text-xs text-violet-400 hover:underline">
            {t('notebook.shared.seeAll')}
          </Link>
          <Link to={socialTabPath('mine')} className="text-xs text-violet-400 hover:underline">
            {t('social.tab.mine')}
          </Link>
        </span>
      </div>
      {invitations.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {invitations.map((item) => (
            <li key={item.token}>
              <InvitationCard item={item} onRespond={respond} />
            </li>
          ))}
        </ul>
      )}
      {accessible.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {accessible.map((item) => (
            <li key={item.token} className="min-w-0 max-w-full">
              <Link
                to={sharedNotePath(item.token)}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-violet-700"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: areaColorOf(item.areaColor) }}
                />
                <span className="truncate">{item.title}</span>
                <span className="shrink-0 text-neutral-500">{t(ROLE_KEY[item.role])}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
