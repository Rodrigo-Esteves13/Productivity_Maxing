import { useI18n } from '../../i18n/useI18n';
import type { PresenceState } from '../../hooks/usePresence';
import CountBadge from '../UI/CountBadge';
import PrefetchLink from '../UI/PrefetchLink';
import { SECTION_LABEL_KEY } from '../../lib/siteMap';
import { ADMIN_NAV, SOCIAL_PATH, isNavActive, navGroups, socialNavTarget, type NavItem } from './navItems';

interface MobileMenuProps {
  currentPath: string;
  isAdmin: boolean;
  socialPending: number;
  onNavigate: () => void;
  // Vem do usePresence da Navbar: "closed" anima a saida antes de desmontar.
  state?: PresenceState;
}

const LINK_BASE = 'flex min-w-0 items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors';
const LINK_ACTIVE = `${LINK_BASE} bg-neutral-800 text-white`;
const LINK_IDLE = `${LINK_BASE} text-neutral-300 hover:bg-neutral-800 hover:text-white`;
const ADMIN_BASE = 'block px-3 py-2 rounded-md text-sm font-bold transition-colors';
const ADMIN_ACTIVE = `${ADMIN_BASE} text-amber-400 bg-amber-400/10`;
const ADMIN_IDLE = `${ADMIN_BASE} text-amber-400 hover:bg-neutral-800`;
const HEADING = 'px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500';

// Todas as paginas do mapa, que seria demasiado para a barra.
const GROUPS = navGroups();

// Painel de navegação para mobile. Em ecrãs < md a Navbar escondia
// Dashboard/Tasks/Profile (NavLinks tinha "hidden md:block" sem
// alternativa nenhuma) e mostrava sempre Areas/Users, o que fazia a
// barra transbordar horizontalmente. Isto junta tudo num único painel
// que abre por baixo da navbar, arrumado pelas secoes do trilho e do
// rodape (Estudo, Em conjunto, Vida...), em duas colunas para caber sem
// scroll. Se mesmo assim nao couber (telemoveis baixos), o painel rola
// sozinho: a navbar e sticky, e o fim da lista ficava inalcancavel.
export default function MobileMenu({ currentPath, isAdmin, socialPending, onNavigate, state = 'open' }: MobileMenuProps) {
  const { t } = useI18n();
  const linkClass = (path: string) => (isNavActive(currentPath, path) ? LINK_ACTIVE : LINK_IDLE);
  const adminClass = (path: string) => (isNavActive(currentPath, path) ? ADMIN_ACTIVE : ADMIN_IDLE);
  const renderItem = (item: NavItem) => {
    const isSocial = item.to === SOCIAL_PATH;
    return (
      <li key={item.to}>
        <PrefetchLink
          to={isSocial ? socialNavTarget(socialPending) : item.to}
          onClick={onNavigate}
          aria-current={isNavActive(currentPath, item.to) ? 'page' : undefined}
          className={linkClass(item.to)}
        >
          <span className="min-w-0 break-words">{t(item.labelKey)}</span>
          {isSocial && <CountBadge count={socialPending} label={t('nav.socialPending', { count: socialPending })} />}
        </PrefetchLink>
      </li>
    );
  };

  return (
    <div data-state={state} className="motion-panel data-[state=closed]:opacity-0 data-[state=closed]:-translate-y-1 data-[state=closed]:duration-[var(--duration-quick)] data-[state=closed]:pointer-events-none xl:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-neutral-800 bg-neutral-950 px-2 pb-3">
      {GROUPS.map((group) => {
        const headingId = `mobile-nav-${group.section}`;
        return (
          <section key={group.section} aria-labelledby={headingId}>
            <p id={headingId} className={HEADING}>
              {t(SECTION_LABEL_KEY[group.section])}
            </p>
            <ul className="grid grid-cols-2 gap-1">{group.items.map(renderItem)}</ul>
          </section>
        );
      })}

      {isAdmin && (
        <section aria-labelledby="mobile-nav-admin">
          <p id="mobile-nav-admin" className={HEADING}>
            {t(SECTION_LABEL_KEY.admin)}
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <PrefetchLink to={item.to} onClick={onNavigate} className={adminClass(item.to)}>
                  {t(item.labelKey)}
                </PrefetchLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
