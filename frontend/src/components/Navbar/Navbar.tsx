import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import UserMenu from './UserMenu';
import MobileMenu from './MobileMenu';
import { MenuIcon, XIcon } from '../UI/Icons';
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
    <nav className="bg-neutral-950 border-b border-neutral-800 text-white sticky top-0 z-50">
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

          {/* 2. Links Normais + Link de Admin - só a partir de md. Em
              mobile isto vivia sempre aberto e não cabia (Areas/Users
              nunca escondiam), por isso passa a viver no MobileMenu. */}
          <div className="hidden md:flex items-center gap-6">
            {isAuthenticated && <NavLinks currentPath={location.pathname} />}

            {role === 'ADMIN' && (
              <>
                <Link
                  to="/areas"
                  aria-current={location.pathname.startsWith('/areas') ? 'page' : undefined}
                  className={`text-sm font-bold transition-colors px-3 py-1.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                    location.pathname.startsWith('/areas')
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
                  }`}
                >
                  Areas
                </Link>
                <Link
                  to="/users"
                  aria-current={location.pathname.startsWith('/users') ? 'page' : undefined}
                  className={`text-sm font-bold transition-colors px-3 py-1.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                    location.pathname.startsWith('/users')
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
                  }`}
                >
                  Users
                </Link>
              </>
            )}
          </div>

          {/* 3. Menu do Utilizador + botão de hambúrguer em mobile */}
          <div className="flex items-center gap-2">
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