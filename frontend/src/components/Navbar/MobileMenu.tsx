import { useI18n } from '../../i18n/useI18n';
import CountBadge from '../UI/CountBadge';
import PrefetchLink from '../UI/PrefetchLink';
import { ACCOUNT_NAV, ADMIN_NAV, MAIN_NAV, SOCIAL_PATH, isNavActive, socialNavTarget, type NavItem } from './navItems';

interface MobileMenuProps {
  currentPath: string;
  isAdmin: boolean;
  socialPending: number;
  onNavigate: () => void;
}

const LINK_BASE = 'block px-3 py-2 rounded-md text-sm font-medium transition-colors';
const LINK_ACTIVE = `${LINK_BASE} bg-neutral-800 text-white`;
const LINK_IDLE = `${LINK_BASE} text-neutral-300 hover:bg-neutral-800 hover:text-white`;
const ADMIN_BASE = 'block px-3 py-2 rounded-md text-sm font-bold transition-colors';
const ADMIN_ACTIVE = `${ADMIN_BASE} text-amber-400 bg-amber-400/10`;
const ADMIN_IDLE = `${ADMIN_BASE} text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800`;

// Painel de navegação para mobile. Em ecrãs < md a Navbar escondia
// Dashboard/Tasks/Profile (NavLinks tinha "hidden md:block" sem
// alternativa nenhuma) e mostrava sempre Areas/Users, o que fazia a
// barra transbordar horizontalmente. Isto junta tudo num único painel
// que abre por baixo da navbar. As listas sao as mesmas da barra e dos
// menus (navItems.ts).
export default function MobileMenu({ currentPath, isAdmin, socialPending, onNavigate }: MobileMenuProps) {
  const { t } = useI18n();
  const linkClass = (path: string) => (isNavActive(currentPath, path) ? LINK_ACTIVE : LINK_IDLE);
  const adminClass = (path: string) => (isNavActive(currentPath, path) ? ADMIN_ACTIVE : ADMIN_IDLE);
  const renderItems = (items: NavItem[], classFor: (path: string) => string) =>
    items.map((item) => (
      <PrefetchLink key={item.to} to={item.to} onClick={onNavigate} className={classFor(item.to)}>
        {t(item.labelKey)}
      </PrefetchLink>
    ));

  return (
    <div className="xl:hidden border-t border-neutral-800 bg-neutral-950 px-2 py-3 space-y-1">
      {renderItems(MAIN_NAV, linkClass)}
      <PrefetchLink
        to={socialNavTarget(socialPending)}
        onClick={onNavigate}
        className={`${linkClass(SOCIAL_PATH)} flex items-center gap-2`}
      >
        {t('nav.social')}
        <CountBadge count={socialPending} label={t('nav.socialPending', { count: socialPending })} />
      </PrefetchLink>
      {renderItems(ACCOUNT_NAV, linkClass)}

      {isAdmin && (
        <>
          <div className="my-2 border-t border-neutral-800" />
          {renderItems(ADMIN_NAV, adminClass)}
        </>
      )}
    </div>
  );
}
