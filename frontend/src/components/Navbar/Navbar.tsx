import { useI18n } from '../../i18n/useI18n';
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavLinks from './NavLinks';
import UserMenu from './UserMenu';
import MobileMenu from './MobileMenu';
import AdminMenu from './AdminMenu';
import OfflineBanner from '../../pwa/OfflineBanner';
import { MenuIcon, XIcon, SearchIcon } from '../UI/Icons';
import { useAuth } from '../../context/useAuth';
import { useSocialPending } from '../../hooks/useSocialPending';
import { OPEN_COMMAND_PALETTE_EVENT } from '../CommandPalette/CommandPaletteHost';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenu = usePresence(isMobileMenuOpen, MODAL_EXIT_MS);
  // Pedidos/convites a espera de resposta: numero ao lado de Social, para
  // um convite para uma nota nao passar despercebido.
  const socialPending = useSocialPending(isAuthenticated)?.total ?? 0;

  // O role vem agora diretamente dos dados reais do user (AuthContext),
  // em vez de andar a descodificar o JWT à mão.
  const role = user?.role;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="print-hide bg-neutral-950 border-b border-neutral-800 text-white sticky top-0 z-50">
      <OfflineBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 whitespace-nowrap">
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
          <div className="hidden xl:flex items-center gap-4">
            {isAuthenticated && <NavLinks currentPath={location.pathname} socialPending={socialPending} />}

            {role === 'ADMIN' && <AdminMenu currentPath={location.pathname} />}
          </div>

          {/* 3. Menu do Utilizador + botão de hambúrguer em mobile */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
                aria-label={t('nav.palette')}
                title={t('nav.search')}
                className="hidden xl:flex shrink-0 items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors rounded-md px-2.5 py-1.5"
              >
                <SearchIcon className="shrink-0" />
                <kbd className="hidden 2xl:inline whitespace-nowrap text-[10px] border border-neutral-700 rounded px-1 py-0.5">
                  {navigator.platform.toUpperCase().includes('MAC') ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            )}
            {isAuthenticated ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Link
                to="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                {t('ui.logIn')}
              </Link>
            )}

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label={isMobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
                aria-expanded={isMobileMenuOpen}
                className="relative xl:hidden inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? <XIcon /> : <MenuIcon />}
                {socialPending > 0 && !isMobileMenuOpen && (
                  <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && mobileMenu.mounted && (
        <MobileMenu
          state={mobileMenu.state}
          currentPath={location.pathname}
          isAdmin={role === 'ADMIN'}
          socialPending={socialPending}
          onNavigate={() => setIsMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
}