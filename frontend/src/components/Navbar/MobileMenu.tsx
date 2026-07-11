import { Link } from 'react-router-dom';

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
        Dashboard
      </Link>
      <Link to="/tasks" onClick={onNavigate} className={getLinkClass('/tasks')}>
        Tasks
      </Link>
      <Link to="/focus" onClick={onNavigate} className={getLinkClass('/focus')}>
        Focus
      </Link>
      <Link to="/profile" onClick={onNavigate} className={getLinkClass('/profile')}>
        Profile
      </Link>

      {isAdmin && (
        <>
          <div className="my-2 border-t border-neutral-800" />
          <Link to="/areas" onClick={onNavigate} className={getAdminLinkClass('/areas')}>
            Areas
          </Link>
          <Link to="/users" onClick={onNavigate} className={getAdminLinkClass('/users')}>
            Users
          </Link>
          <Link to="/task-types" onClick={onNavigate} className={getAdminLinkClass('/task-types')}>
            Task Types
          </Link>
          <Link to="/security" onClick={onNavigate} className={getAdminLinkClass('/security')}>
            Security
          </Link>
        </>
      )}
    </div>
  );
}
