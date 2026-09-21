import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import UserMenu from './UserMenu';
import MobileMenu from './MobileMenu';
import AdminMenu from './AdminMenu';
import { MenuIcon, XIcon, SearchIcon } from '../UI/Icons';
import { useAuth } from '../../context/useAuth';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // O role vem agora diretamente dos dados reais do user (AuthContext),
  // em vez de andar a descodificar o JWT à mão.
  const role = user?.role;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="print-hide bg-neutral-950 border-b border-neutral-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link
              to={isAuthenticated ? "/dashboard" : "/"}
              className="text-xl font-bold tracking-wider text-violet-500 hover:text-violet-400 transition-colors"
            >
              Productivity Maxing
            </Link>
          </div>

          {/* 2. Links Normais + dropdown de Admin - só a partir de md. Em
              mobile isto vivia sempre aberto e não cabia (Areas/Users
              nunca escondiam), por isso passa a viver no MobileMenu. Os 4
              links de admin deixaram de ir soltos para a barra (era isso
              que estourava a largura em ecrãs de portátil, ~1280-1366px);
              agora vivem atrás de um único trigger "Admin" (AdminMenu). */}
          <div className="hidden md:flex items-center gap-6">
            {isAuthenticated && <NavLinks currentPath={location.pathname} />}

            {role === 'ADMIN' && <AdminMenu currentPath={location.pathname} />}
          </div>

          {/* 3. Menu do Utilizador + botão de hambúrguer em mobile */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pmaxing:open-command-palette'))}
                aria-label="Open command palette"
                title="Search / go to (Ctrl+K)"
                className="hidden sm:flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors rounded-md px-2.5 py-1.5"
              >
                <SearchIcon className="shrink-0" />
                <kbd className="text-[10px] border border-neutral-700 rounded px-1 py-0.5">
                  {navigator.platform.toUpperCase().includes('MAC') ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            )}
            {isAuthenticated ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <span className="text-sm font-medium text-neutral-500 italic">
                Not Authenticated
              </span>
            )}

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
                className="md:hidden p-2 rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? <XIcon /> : <MenuIcon />}
              </button>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && isMobileMenuOpen && (
        <MobileMenu
          currentPath={location.pathname}
          isAdmin={role === 'ADMIN'}
          onNavigate={() => setIsMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
}