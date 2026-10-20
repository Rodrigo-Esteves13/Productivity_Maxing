import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PrefetchLink from '../UI/PrefetchLink';
import { ACCOUNT_NAV } from './navItems';
import type { User } from '../../types/models';
import { LogoutIcon } from '../UI/Icons';
import Avatar from '../Profile/Avatar';
import { useI18n } from '../../i18n/useI18n';

// Lazy e montado so quando aberto: quase ninguem envia feedback numa visita.
const FeedbackModal = lazy(() => import('../Feedback/FeedbackModal'));

interface UserMenuProps {
  user: User | null;
  onLogout: () => void;
}

function getInitials(user: User): string {
  if (user.name) return user.name.substring(0, 2).toUpperCase();
  return user.email.substring(0, 2).toUpperCase();
}

function getFirstName(user: User): string {
  if (user.name) return user.name.trim().split(' ')[0];
  return user.email.split('@')[0];
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ainda a carregar os dados reais do user: mostra um placeholder discreto
  if (!user) {
    return <div className="ml-4 h-9 w-24 rounded-full bg-neutral-900 animate-pulse" />;
  }

  const initials = getInitials(user);
  const firstName = getFirstName(user);

  return (
    <div className="relative ml-2 shrink-0" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('nav.menu')}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-neutral-800 transition-colors focus:outline-none"
      >
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt={firstName} size="sm" />
        <span className="hidden 2xl:inline max-w-[10rem] truncate text-sm font-medium text-neutral-200">
          {t('nav.hello', { name: firstName })}
        </span>
      </button>

      {isOpen && (
        <div role="menu" className="absolute right-0 mt-2 w-max min-w-48 max-w-[min(20rem,calc(100vw-1rem))] overflow-hidden bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50">
          {ACCOUNT_NAV.map((item) => (
            <PrefetchLink
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm break-words text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              {t(item.labelKey)}
            </PrefetchLink>
          ))}
          <button
            onClick={() => {
              setIsOpen(false);
              setIsFeedbackOpen(true);
            }}
            className="block w-full text-left px-4 py-2.5 text-sm break-words text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            {t('feedback.open')}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm break-words text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            <LogoutIcon />
            {t('nav.logout')}
          </button>
        </div>
      )}
      {isFeedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen onClose={() => setIsFeedbackOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
