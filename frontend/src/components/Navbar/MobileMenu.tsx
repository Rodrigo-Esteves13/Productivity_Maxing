import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

interface MobileMenuProps {
  currentPath: string;
  isAdmin: boolean;
  onNavigate: () => void;
}

// Painel de navegação para mobile. Em ecrãs < md a Navbar escondia
// Dashboard/Tasks/Profile (NavLinks tinha "hidden md:block" sem
// alternativa nenhuma) e mostrava sempre Areas/Users, o que fazia a
// barra transbordar horizontalmente. Isto junta tudo num único painel
// que abre por baixo da navbar.
export default function MobileMenu({ currentPath, isAdmin, onNavigate }: MobileMenuProps) {
  const { t } = useI18n();
  const getLinkClass = (path: string) => {
    const base = 'block px-3 py-2 rounded-md text-sm font-medium transition-colors';
    return currentPath.startsWith(path)
      ? `${base} bg-neutral-800 text-white`
      : `${base} text-neutral-300 hover:bg-neutral-800 hover:text-white`;
  };

  const getAdminLinkClass = (path: string) => {
    const base = 'block px-3 py-2 rounded-md text-sm font-bold transition-colors';
    return currentPath.startsWith(path)
      ? `${base} text-amber-400 bg-amber-400/10`
      : `${base} text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800`;
  };

  return (
    <div className="md:hidden border-t border-neutral-800 bg-neutral-950 px-2 py-3 space-y-1">
      <Link to="/dashboard" onClick={onNavigate} className={getLinkClass('/dashboard')}>
        {t('nav.dashboard')}
      </Link>
      <Link to="/tasks" onClick={onNavigate} className={getLinkClass('/tasks')}>
        {t('nav.tasks')}
      </Link>
      <Link to="/focus" onClick={onNavigate} className={getLinkClass('/focus')}>
        {t('nav.focus')}
      </Link>
      <Link to="/schedule" onClick={onNavigate} className={getLinkClass('/schedule')}>
        {t('nav.schedule')}
      </Link>
      <Link to="/notebook" onClick={onNavigate} className={getLinkClass('/notebook')}>
        {t('nav.notebook')}
      </Link>
      <Link to="/areas" onClick={onNavigate} className={getLinkClass('/areas')}>
        {t('nav.areas')}
      </Link>
      <Link to="/profile" onClick={onNavigate} className={getLinkClass('/profile')}>
        {t('nav.profile')}
      </Link>
      <Link to="/developer" onClick={onNavigate} className={getLinkClass('/developer')}>
        {t('nav.developer')}
      </Link>
      <Link to="/agent" onClick={onNavigate} className={getLinkClass('/agent')}>
        {t('nav.agent')}
      </Link>

      {isAdmin && (
        <>
          <div className="my-2 border-t border-neutral-800" />
          <Link to="/users" onClick={onNavigate} className={getAdminLinkClass('/users')}>
            Users
          </Link>
          <Link to="/task-types" onClick={onNavigate} className={getAdminLinkClass('/task-types')}>
            Task Types
          </Link>
          <Link to="/security" onClick={onNavigate} className={getAdminLinkClass('/security')}>
            Security
          </Link>
          <Link to="/appeals" onClick={onNavigate} className={getAdminLinkClass('/appeals')}>
            Appeals
          </Link>
          <Link to="/feedback" onClick={onNavigate} className={getAdminLinkClass('/feedback')}>
            Feedback
          </Link>
        </>
      )}
    </div>
  );
}
